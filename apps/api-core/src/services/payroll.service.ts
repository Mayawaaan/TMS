import { withTransaction } from '../config/db.js';
import { invalidateCache } from '../config/redis.js';
import { HttpError } from '../middleware/index.js';
import { Advance, Attendance, Employee, Payslip, Setting, Trip } from '../models/index.js';
import { postJournal } from './ledger.service.js';
import type { Actor } from './trip.service.js';

const monthRange = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
};

export async function currentDieselPrice(): Promise<number> {
  const s = await Setting.findOne({ key: 'dieselPrice' }).lean();
  return (s?.value as number) ?? 90.5;
}

/**
 * Net Payable Salary = Base Salary + Σ(Trip Bhatta) + (Total KM × KM Incentive) − Cash Advances Taken − Fuel Shortage Penalties
 * Fuel shortage = liters consumed beyond the AI expected-kmpl allowance on trips flagged for theft, charged at diesel price.
 */
export async function computePayslip(employeeId: string, month: string) {
  const emp = await Employee.findById(employeeId).lean();
  if (!emp) throw new HttpError(404, 'Employee not found');
  const { from, to } = monthRange(month);
  const trips = await Trip.find({ driver: emp._id, fleetType: 'OWN', unloadedAt: { $gte: from, $lt: to } }).lean();
  const tripBhatta = trips.filter((t) => t.settlement?.status === 'APPROVED').reduce((s, t) => s + (t.expenses?.bhatta ?? 0), 0);
  const totalKm = trips.reduce((s, t) => s + (t.endOdometer && t.startOdometer ? t.endOdometer - t.startOdometer : t.distanceKm), 0);
  const kmIncentive = Math.round(totalKm * (emp.kmIncentive ?? 0));
  const advances = await Advance.find({ employee: emp._id, recovered: false, date: { $lt: to } }).lean();
  const cashAdvances = advances.reduce((s, a) => s + a.amount, 0);

  const diesel = await currentDieselPrice();
  let shortageLiters = 0;
  for (const t of trips) {
    const a = t.aiAudit;
    if (a?.isFlaggedForTheft && a.expectedKmpl && t.expenses?.dieselLiters) {
      const km = t.endOdometer && t.startOdometer ? t.endOdometer - t.startOdometer : t.distanceKm;
      const allowed = km / a.expectedKmpl;
      shortageLiters += Math.max(0, t.expenses.dieselLiters - allowed * 1.05); // 5% tolerance
    }
  }
  const fuelShortagePenalty = Math.round(shortageLiters * diesel);
  const gross = emp.baseSalary + tripBhatta + kmIncentive;
  const netPayable = Math.max(0, Math.round(gross - cashAdvances - fuelShortagePenalty));
  const days = await Attendance.countDocuments({ employee: emp._id, date: { $gte: month + '-01', $lt: month + '-32' }, status: { $in: ['PRESENT', 'ON_TRIP'] } });
  return {
    employee: emp._id,
    month,
    baseSalary: emp.baseSalary,
    tripBhatta,
    totalKm,
    kmIncentiveRate: emp.kmIncentive ?? 0,
    kmIncentive,
    cashAdvances,
    fuelShortageLiters: Math.round(shortageLiters * 10) / 10,
    fuelShortagePenalty,
    netPayable,
    trips: trips.map((t) => t._id),
    daysPresent: days,
    _advanceIds: advances.map((a) => a._id),
  };
}

/** Generates (or refreshes) DRAFT payslips for every active driver for the month. */
export async function generatePayrollRun(month: string) {
  const drivers = await Employee.find({ active: true, designation: 'DRIVER' }).lean();
  const out = [];
  for (const d of drivers) {
    const existing = await Payslip.findOne({ employee: d._id, month }).lean();
    if (existing && existing.status !== 'DRAFT') {
      out.push(existing);
      continue;
    }
    const { _advanceIds, ...calc } = await computePayslip(String(d._id), month);
    void _advanceIds;
    out.push(await Payslip.findOneAndUpdate({ employee: d._id, month }, { ...calc, status: 'DRAFT' }, { upsert: true, new: true }));
  }
  return out;
}

/** Approve → accrue base salary + KM incentive (bhatta already accrued at trip settlement). */
export async function approvePayslip(id: string, actor: Actor, at = new Date()) {
  const res = await withTransaction(async (session) => {
    const slip = await Payslip.findById(id).session(session);
    if (!slip) throw new HttpError(404, 'Payslip not found');
    if (slip.status !== 'DRAFT') throw new HttpError(409, `Payslip already ${slip.status}`);
    const emp = await Employee.findById(slip.employee).session(session);
    const accrual = slip.baseSalary + slip.kmIncentive;
    await postJournal(
      [
        { account: 'SALARY_EXPENSE', debit: accrual },
        { account: 'SALARY_PAYABLE', credit: accrual },
      ],
      { date: at, narration: `Salary accrual ${slip.month} — ${emp?.name} (base ₹${slip.baseSalary} + KM incentive ₹${slip.kmIncentive})`, refType: 'PAYROLL', refId: slip._id, party: { kind: 'EMPLOYEE', id: emp?._id, name: emp?.name }, postedBy: actor.id },
      session,
    );
    slip.status = 'APPROVED';
    slip.approvedBy = actor.id as never;
    await slip.save({ session });
    return slip;
  });
  await invalidateCache('cache:analytics:*');
  return res;
}

/** Pay → clears Salary Payable against Bank (net), Driver Advance recovery and fuel-shortage recovery. */
export async function payPayslip(id: string, actor: Actor, at = new Date()) {
  const res = await withTransaction(async (session) => {
    const slip = await Payslip.findById(id).session(session);
    if (!slip) throw new HttpError(404, 'Payslip not found');
    if (slip.status !== 'APPROVED') throw new HttpError(409, 'Payslip must be APPROVED before payment');
    const emp = await Employee.findById(slip.employee).session(session);
    const gross = slip.baseSalary + slip.tripBhatta + slip.kmIncentive;
    const penalty = Math.min(slip.fuelShortagePenalty, gross);
    const advRecovered = Math.min(slip.cashAdvances, gross - penalty);
    const net = gross - penalty - advRecovered;
    await postJournal(
      [
        { account: 'SALARY_PAYABLE', debit: gross },
        { account: 'BANK', credit: net },
        { account: 'DRIVER_ADVANCE', credit: advRecovered },
        { account: 'DIESEL_EXPENSE', credit: penalty },
      ],
      { date: at, narration: `Salary paid ${slip.month} — ${emp?.name}: net ₹${net}, advance recovered ₹${advRecovered}, fuel shortage ₹${penalty}`, refType: 'PAYROLL', refId: slip._id, party: { kind: 'EMPLOYEE', id: emp?._id, name: emp?.name }, postedBy: actor.id },
      session,
    );
    // Mark advances recovered oldest-first up to the recovered amount.
    let left = advRecovered;
    const advs = await Advance.find({ employee: slip.employee, recovered: false, date: { $lt: monthRange(slip.month).to } }).sort({ date: 1 }).session(session);
    for (const a of advs) {
      if (left + 0.5 < a.amount) break;
      left -= a.amount;
      a.recovered = true;
      a.payslip = slip._id;
      await a.save({ session });
    }
    slip.status = 'PAID';
    slip.paidAt = at;
    await slip.save({ session });
    return slip;
  });
  await invalidateCache('cache:analytics:*');
  return res;
}
