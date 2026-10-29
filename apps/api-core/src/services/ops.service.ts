import { withTransaction } from '../config/db.js';
import { invalidateCache } from '../config/redis.js';
import { HttpError } from '../middleware/index.js';
import { Maintenance, Truck, Vendor, type COMPONENTS } from '../models/index.js';
import { nextSequence, postJournal } from './ledger.service.js';
import type { Actor } from './trip.service.js';

export interface MaintenanceInput {
  truck: string;
  type: 'SCHEDULED' | 'BREAKDOWN';
  component?: (typeof COMPONENTS)[number];
  workshop?: string;
  location?: string;
  odometer?: number;
  description: string;
  parts?: { name: string; partNo?: string; qty: number; unitCost: number }[];
  labourCost?: number;
  downtimeHours?: number;
  date?: Date;
}

export async function raiseMaintenance(input: MaintenanceInput, actor: Actor) {
  return withTransaction(async (session) => {
    const truck = await Truck.findById(input.truck).session(session);
    if (!truck) throw new HttpError(404, 'Truck not found');
    const date = input.date ?? new Date();
    const partsCost = (input.parts ?? []).reduce((s, p) => s + p.qty * p.unitCost, 0);
    const labour = input.labourCost ?? 0;
    const odometer = input.odometer ?? truck.currentOdometer;
    const comp = input.component ?? 'GENERAL';
    const lastSvc = comp !== 'GENERAL' ? (truck.componentService as Record<string, number>)?.[comp] ?? 0 : truck.lastServiceOdometer ?? 0;
    const seq = await nextSequence(`JOB-${date.getFullYear()}`, session);
    const [job] = await Maintenance.create(
      [{ jobNo: `WS/${date.getFullYear()}/${String(seq).padStart(5, '0')}`, truck: truck._id, type: input.type, component: comp, workshop: input.workshop, location: input.location, odometer, kmSinceLastService: odometer - lastSvc, description: input.description, parts: input.parts ?? [], labourCost: labour, partsCost, totalCost: partsCost + labour, downtimeHours: input.downtimeHours ?? 0, date, status: 'PENDING', raisedBy: actor.id }],
      { session },
    );
    if (input.type === 'BREAKDOWN' && truck.status === 'AVAILABLE') {
      truck.status = 'BREAKDOWN';
      await truck.save({ session });
    }
    return job;
  });
}

/** MANAGER/ADMIN authorises a workshop or RTO/Challan bill → Dr Expense / Cr Payable or Cash. */
export async function approveMaintenance(id: string, actor: Actor, at = new Date()) {
  const res = await withTransaction(async (session) => {
    const job = await Maintenance.findById(id).session(session);
    if (!job) throw new HttpError(404, 'Job card / Challan bill not found');
    if (job.status !== 'PENDING') throw new HttpError(409, `Bill already ${job.status}`);
    const truck = await Truck.findById(job.truck).session(session);
    const ws = job.workshop ? await Vendor.findById(job.workshop).session(session) : null;
    const debitAccount =
      job.component === 'TYRE'
        ? 'TYRE_EXPENSE'
        : job.component === 'PUC_INSURANCE'
        ? 'INSURANCE_EXPENSE'
        : 'MAINTENANCE_EXPENSE';
    await postJournal(
      [
        { account: debitAccount, debit: job.totalCost },
        { account: ws ? 'WORKSHOP_PAYABLE' : 'CASH', credit: job.totalCost },
      ],
      {
        date: at,
        narration: `Cleared [${job.component}] ${job.jobNo} — ${truck?.regNumber}: ${job.description}`,
        refType: 'MAINTENANCE',
        refId: job._id,
        party: ws ? { kind: 'VENDOR', id: ws._id, name: ws.name } : undefined,
        truck: truck?._id,
        postedBy: actor.id,
      },
      session,
    );
    if (ws) {
      ws.currentOutstanding += job.totalCost;
      await ws.save({ session });
    }
    job.status = 'APPROVED';
    job.approvedBy = actor.id as never;
    job.approvedAt = at;
    await job.save({ session });
    if (truck) {
      const mechanicalComponents = ['BRAKE_PAD', 'CLUTCH_PLATE', 'ENGINE_OIL', 'TYRE'];
      if (job.component && mechanicalComponents.includes(job.component)) {
        truck.set(`componentService.${job.component}`, job.odometer);
      }
      // Renew RTO / Fitness / Permit / State Tax compliance expiry by 1 year when cleared by Manager
      const nextYear = new Date(at.getTime() + 365 * 24 * 60 * 60 * 1000);
      if (job.component === 'RTO_FITNESS' && truck.compliance?.fitness) {
        truck.compliance.fitness.expiry = nextYear;
      } else if (job.component === 'NATIONAL_PERMIT' && truck.compliance?.nationalPermit) {
        truck.compliance.nationalPermit.expiry = nextYear;
      } else if (job.component === 'PUC_INSURANCE' && truck.compliance?.puc) {
        truck.compliance.puc.expiry = nextYear;
      } else if (job.component === 'STATE_TAX_CHALLAN' && truck.compliance?.stateTax) {
        truck.compliance.stateTax.expiry = nextYear;
      }
      if (job.type === 'SCHEDULED') truck.lastServiceOdometer = job.odometer;
      if (truck.status === 'BREAKDOWN' || truck.status === 'MAINTENANCE') truck.status = 'AVAILABLE';
      await truck.save({ session });
    }
    return job;
  });
  await invalidateCache('cache:analytics:*');
  return res;
}

export async function rejectMaintenance(id: string, actor: Actor) {
  const job = await Maintenance.findOneAndUpdate({ _id: id, status: 'PENDING' }, { status: 'REJECTED', approvedBy: actor.id, approvedAt: new Date() }, { new: true });
  if (!job) throw new HttpError(409, 'Job not pending');
  return job;
}

/** Pay a vendor (pump/workshop/broker) outstanding → Dr Payable / Cr Bank. */
export async function payVendor(vendorId: string, amount: number, actor: Actor, at = new Date()) {
  const res = await withTransaction(async (session) => {
    const v = await Vendor.findById(vendorId).session(session);
    if (!v) throw new HttpError(404, 'Vendor not found');
    if (amount <= 0 || amount > v.currentOutstanding + 0.5) throw new HttpError(422, `Amount must be ≤ outstanding ₹${v.currentOutstanding}`);
    const account = v.type === 'PETROL_PUMP' ? 'PUMP_PAYABLE' : v.type === 'BROKER' ? 'BROKER_PAYABLE' : 'WORKSHOP_PAYABLE';
    await postJournal(
      [
        { account, debit: amount },
        { account: 'BANK', credit: amount },
      ],
      { date: at, narration: `Payment to ${v.name}`, refType: 'PAYMENT', refId: v._id, party: { kind: 'VENDOR', id: v._id, name: v.name }, postedBy: actor.id },
      session,
    );
    v.currentOutstanding = Math.round((v.currentOutstanding - amount) * 100) / 100;
    await v.save({ session });
    return v;
  });
  await invalidateCache('cache:analytics:*');
  return res;
}

/** Fixed fleet overheads: EMI (principal → loan, interest → expense) and insurance renewal. */
export async function postFixedCost(kind: 'EMI' | 'INSURANCE', truckId: string, amount: number, actor: Actor, at = new Date(), interestShare = 0.32) {
  const res = await withTransaction(async (session) => {
    const truck = await Truck.findById(truckId).session(session);
    if (!truck) throw new HttpError(404, 'Truck not found');
    if (kind === 'EMI') {
      const interest = Math.round(amount * interestShare);
      await postJournal(
        [
          { account: 'EMI_INTEREST_EXPENSE', debit: interest },
          { account: 'LOAN_PAYABLE', debit: amount - interest },
          { account: 'BANK', credit: amount },
        ],
        { date: at, narration: `EMI ${truck.emiLender ?? ''} — ${truck.regNumber}`, refType: 'EMI', refId: truck._id, party: { kind: 'LENDER', name: truck.emiLender ?? 'Lender' }, truck: truck._id, postedBy: actor.id },
        session,
      );
    } else {
      await postJournal(
        [
          { account: 'INSURANCE_EXPENSE', debit: amount },
          { account: 'BANK', credit: amount },
        ],
        { date: at, narration: `Insurance premium — ${truck.regNumber}`, refType: 'INSURANCE', refId: truck._id, truck: truck._id, postedBy: actor.id },
        session,
      );
    }
    return { ok: true };
  });
  await invalidateCache('cache:analytics:*');
  return res;
}

/** Owner capital / drawings — ADMIN only (and PIN protected at route level). */
export async function postOwnerEquity(kind: 'CAPITAL' | 'DRAWINGS', amount: number, narration: string, actor: Actor, at = new Date()) {
  const res = await withTransaction(async (session) =>
    postJournal(
      kind === 'CAPITAL'
        ? [
            { account: 'BANK', debit: amount },
            { account: 'OWNER_EQUITY', credit: amount },
          ]
        : [
            { account: 'OWNER_EQUITY', debit: amount },
            { account: 'BANK', credit: amount },
          ],
      { date: at, narration, refType: kind, party: { kind: 'OWNER', name: 'Proprietor' }, postedBy: actor.id },
      session,
    ),
  );
  await invalidateCache('cache:analytics:*');
  return res;
}
