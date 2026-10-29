import { cached } from '../config/redis.js';
import { ACCOUNT_CLASS, LedgerEntry, Maintenance, Trip, Truck, Client, type Account } from '../models/index.js';

const DAY = 86400000;
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface Period {
  from: Date;
  to: Date;
}
export const defaultPeriod = (daysBack = 120): Period => ({ from: new Date(Date.now() - daysBack * DAY), to: new Date(Date.now() + DAY) });

/** Σdebit, Σcredit, natural balance per account for a period. */
export async function accountBalances(p?: Period) {
  const match = p ? { date: { $gte: p.from, $lt: p.to } } : {};
  const rows = await LedgerEntry.aggregate<{ _id: Account; debit: number; credit: number }>([
    { $match: match },
    { $group: { _id: '$account', debit: { $sum: '$debit' }, credit: { $sum: '$credit' } } },
  ]);
  const out = {} as Record<Account, { debit: number; credit: number; balance: number }>;
  for (const r of rows) {
    const cls = ACCOUNT_CLASS[r._id];
    const natural = cls === 'ASSET' || cls === 'EXPENSE' ? r.debit - r.credit : r.credit - r.debit;
    out[r._id] = { debit: r2(r.debit), credit: r2(r.credit), balance: r2(natural) };
  }
  return out;
}

const bal = (b: Awaited<ReturnType<typeof accountBalances>>, a: Account) => b[a]?.balance ?? 0;

export async function trialBalance() {
  const b = await accountBalances();
  const rows = Object.entries(b).map(([account, v]) => ({ account, class: ACCOUNT_CLASS[account as Account], ...v }));
  const totalDebit = r2(rows.reduce((s, r) => s + r.debit, 0));
  const totalCredit = r2(rows.reduce((s, r) => s + r.credit, 0));
  return { rows: rows.sort((a, b2) => a.class.localeCompare(b2.class)), totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.01 };
}

export async function profitAndLoss(p: Period) {
  const b = await accountBalances(p);
  const revenue = bal(b, 'FREIGHT_REVENUE') + bal(b, 'DETENTION_REVENUE');
  const direct = {
    diesel: bal(b, 'DIESEL_EXPENSE'),
    toll: bal(b, 'TOLL_EXPENSE'),
    bhatta: bal(b, 'DRIVER_BHATTA_EXPENSE'),
    rto: bal(b, 'RTO_EXPENSE'),
    loading: bal(b, 'LOADING_EXPENSE'),
    lorryHire: bal(b, 'LORRY_HIRE_EXPENSE'),
  };
  const overhead = {
    maintenance: bal(b, 'MAINTENANCE_EXPENSE'),
    tyres: bal(b, 'TYRE_EXPENSE'),
    salaries: bal(b, 'SALARY_EXPENSE'),
    insurance: bal(b, 'INSURANCE_EXPENSE'),
    emiInterest: bal(b, 'EMI_INTEREST_EXPENSE'),
  };
  const directTotal = Object.values(direct).reduce((s, v) => s + v, 0);
  const overheadTotal = Object.values(overhead).reduce((s, v) => s + v, 0);
  const netProfit = revenue - directTotal - overheadTotal;
  const ebitda = netProfit + overhead.emiInterest; // no depreciation booked
  return { revenue: r2(revenue), direct, directTotal: r2(directTotal), overhead, overheadTotal: r2(overheadTotal), netProfit: r2(netProfit), ebitda: r2(ebitda), marginPct: revenue ? r2((netProfit / revenue) * 100) : 0 };
}

/** Cashflow waterfall: Gross Billed → Direct Trip Costs → Fixed Overheads (EMI/Maint/Salaries) → Uncollected Receivables → Net Free Cashflow */
export async function cashflowWaterfall(p: Period) {
  const b = await accountBalances(p);
  const pl = await profitAndLoss(p);
  const grossBilled = b.ACCOUNTS_RECEIVABLE?.debit ?? 0; // invoices raised (incl. FCM GST)
  const collected = b.ACCOUNTS_RECEIVABLE?.credit ?? 0;
  const emiPrincipal = b.LOAN_PAYABLE?.debit ?? 0;
  const fixed = pl.overheadTotal + emiPrincipal;
  const uncollected = Math.max(0, grossBilled - collected);
  const net = grossBilled - pl.directTotal - fixed - uncollected;
  const steps = [
    { name: 'Gross Billed Freight', value: r2(grossBilled), kind: 'total' },
    { name: 'Direct Trip Costs', value: -r2(pl.directTotal), kind: 'delta', breakdown: pl.direct },
    { name: 'Fixed Fleet Overheads', value: -r2(fixed), kind: 'delta', breakdown: { ...pl.overhead, emiPrincipal: r2(emiPrincipal) } },
    { name: 'Uncollected Receivables', value: -r2(uncollected), kind: 'delta' },
    { name: 'Net Free Cashflow', value: r2(net), kind: 'total' },
  ];
  let running = 0;
  return steps.map((s) => {
    if (s.kind === 'total') {
      running = s.value;
      return { ...s, start: 0, end: s.value };
    }
    const start = running;
    running += s.value;
    return { ...s, start, end: running };
  });
}

/** Fleet unit economics: X = monthly KM, Y = net profit/KM (after maintenance + EMI), size = maintenance spend. */
export async function fleetUnitEconomics(p: Period) {
  const months = Math.max(1, (p.to.getTime() - p.from.getTime()) / (30 * DAY));
  const [trucks, trips, maint] = await Promise.all([
    Truck.find().lean(),
    Trip.find({ fleetType: 'OWN', unloadedAt: { $gte: p.from, $lt: p.to } }).select('truck distanceKm startOdometer endOdometer economics').lean(),
    Maintenance.aggregate<{ _id: unknown; total: number; breakdowns: number }>([
      { $match: { status: 'APPROVED', date: { $gte: p.from, $lt: p.to } } },
      { $group: { _id: '$truck', total: { $sum: '$totalCost' }, breakdowns: { $sum: { $cond: [{ $eq: ['$type', 'BREAKDOWN'] }, 1, 0] } } } },
    ]),
  ]);
  const mMap = new Map(maint.map((m) => [String(m._id), m]));
  const rows = trucks.map((t) => {
    const tt = trips.filter((x) => String(x.truck) === String(t._id));
    const km = tt.reduce((s, x) => s + (x.endOdometer && x.startOdometer ? x.endOdometer - x.startOdometer : x.distanceKm), 0);
    const tripProfit = tt.reduce((s, x) => s + (x.economics?.netProfit ?? 0), 0);
    const m = mMap.get(String(t._id));
    const maintenance = m?.total ?? 0;
    const emi = (t.emiAmount ?? 0) * months;
    const net = tripProfit - maintenance - emi;
    return {
      truckId: t._id,
      regNumber: t.regNumber,
      axleConfig: t.axleConfig,
      make: `${t.make} ${t.model}`,
      trips: tt.length,
      monthlyKm: Math.round(km / months),
      netProfitPerKm: km ? r2(net / km) : 0,
      netProfit: Math.round(net),
      maintenance: Math.round(maintenance),
      breakdowns: m?.breakdowns ?? 0,
    };
  });
  const sortedPpk = rows.map((r) => r.netProfitPerKm).sort((a, b) => a - b);
  const p66 = sortedPpk[Math.floor(sortedPpk.length * 0.66)] ?? 0;
  const medKm = rows.map((r) => r.monthlyKm).sort((a, b) => a - b)[Math.floor(rows.length / 2)] ?? 0;
  return rows.map((r) => ({
    ...r,
    category: r.netProfitPerKm < 0 || (r.breakdowns >= 2 && r.netProfitPerKm < p66 / 2) ? 'LEMON' : r.netProfitPerKm >= p66 && r.monthlyKm >= medKm ? 'STAR' : 'CORE',
  }));
}

/** Corridor profitability ranked by profit-per-day, with empirical backhaul rate. */
export async function corridorProfitability(p: Period) {
  const trips = await Trip.find({ indentDate: { $gte: p.from, $lt: p.to }, status: { $in: ['UNLOADED', 'POD_UPLOADED', 'SETTLED'] } })
    .select('origin destination corridor loadedAt unloadedAt indentDate economics distanceKm truck fleetType')
    .lean();
  const byCorr = new Map<string, typeof trips>();
  for (const t of trips) byCorr.set(t.corridor, [...(byCorr.get(t.corridor) ?? []), t]);
  const result = [...byCorr.entries()].map(([corridor, tt]) => {
    const { origin, destination } = tt[0];
    const totalProfit = tt.reduce((s, t) => s + (t.economics?.netProfit ?? 0), 0);
    const totalDays = tt.reduce((s, t) => s + Math.max(0.5, ((t.unloadedAt ?? t.indentDate).getTime() - (t.loadedAt ?? t.indentDate).getTime()) / DAY), 0);
    // Backhaul: share of arrivals at destination followed by a reverse-corridor load within 4 days.
    const reverse = trips.filter((r) => r.origin === destination && r.destination === origin);
    const backhauled = tt.filter((t) => reverse.some((r) => Math.abs(r.indentDate.getTime() - (t.unloadedAt ?? t.indentDate).getTime()) < 4 * DAY)).length;
    return {
      corridor,
      origin,
      destination,
      trips: tt.length,
      revenue: Math.round(tt.reduce((s, t) => s + (t.economics?.revenue ?? 0), 0)),
      avgProfit: Math.round(totalProfit / tt.length),
      profitPerDay: Math.round(totalProfit / totalDays),
      avgMarginPct: r2(tt.reduce((s, t) => s + (t.economics?.marginPct ?? 0), 0) / tt.length),
      backhaulRate: r2(backhauled / tt.length),
      distanceKm: tt[0].distanceKm,
    };
  });
  return result.sort((a, b) => b.profitPerDay - a.profitPerDay);
}

/** Expected vs actual fleet mileage per trip chronologically, flagging AI anomalies. */
export async function fuelVsBaseline(p: Period) {
  const trips = await Trip.find({ fleetType: 'OWN', unloadedAt: { $gte: p.from, $lt: p.to }, 'expenses.dieselLiters': { $gt: 0 } })
    .sort({ unloadedAt: 1 })
    .populate('truck', 'regNumber baselineKmpl')
    .select('lrNumber unloadedAt economics aiAudit truck weightTons routeGradientFactor')
    .lean();
  return trips.map((t) => {
    const truck = t.truck as unknown as { regNumber: string; baselineKmpl: number } | null;
    return {
      lrNumber: t.lrNumber,
      date: t.unloadedAt,
      regNumber: truck?.regNumber,
      actualKmpl: t.economics?.actualKmpl ?? null,
      expectedKmpl: t.aiAudit?.expectedKmpl ?? null,
      baselineKmpl: truck?.baselineKmpl ?? null,
      anomalyScore: t.aiAudit?.anomalyScore ?? null,
      flagged: !!t.aiAudit?.isFlaggedForTheft,
      audited: !!t.aiAudit?.auditedAt,
    };
  });
}

/** Receivables aging buckets (0–30, 31–60, 61–90, 90+) overall and per client. */
export async function receivablesAging() {
  const now = Date.now();
  const trips = await Trip.find({ 'invoice.status': { $in: ['BILLED', 'PARTIAL'] } }).populate('client', 'name code creditLimit currentOutstanding').select('invoice client lrNumber').lean();
  const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  const perClient = new Map<string, { client: string; code: string; creditLimit: number; total: number; '0-30': number; '31-60': number; '61-90': number; '90+': number }>();
  for (const t of trips) {
    const due = (t.invoice?.total ?? 0) - (t.invoice?.paidAmount ?? 0);
    const age = Math.floor((now - new Date(t.invoice!.date!).getTime()) / DAY);
    const k = age <= 30 ? '0-30' : age <= 60 ? '31-60' : age <= 90 ? '61-90' : '90+';
    buckets[k] += due;
    const c = t.client as unknown as { _id: string; name: string; code: string; creditLimit: number };
    const row = perClient.get(String(c._id)) ?? { client: c.name, code: c.code, creditLimit: c.creditLimit, total: 0, '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    row[k] += due;
    row.total += due;
    perClient.set(String(c._id), row);
  }
  return {
    buckets: Object.entries(buckets).map(([bucket, amount]) => ({ bucket, amount: Math.round(amount) })),
    clients: [...perClient.values()].map((r) => ({ ...r, total: Math.round(r.total) })).sort((a, b) => b.total - a.total),
  };
}

export const COMPLIANCE_LABELS: Record<string, string> = { insurance: 'Insurance', fitness: 'Fitness', nationalPermit: 'National Permit', puc: 'PUC', stateTax: 'State Tax' };

export function complianceLevel(daysLeft: number) {
  if (daysLeft < 0) return 'EXPIRED';
  if (daysLeft <= 7) return 'CRITICAL';
  if (daysLeft <= 15) return 'WARNING';
  if (daysLeft <= 30) return 'NOTICE';
  return 'OK';
}

export async function complianceWatchdog() {
  const trucks = await Truck.find().select('regNumber compliance').lean();
  const items: { truckId: unknown; regNumber: string; doc: string; label: string; expiry: Date; daysLeft: number; level: string }[] = [];
  for (const t of trucks) {
    for (const [doc, label] of Object.entries(COMPLIANCE_LABELS)) {
      const d = (t.compliance as Record<string, { expiry: Date }>)[doc];
      if (!d?.expiry) continue;
      const daysLeft = Math.floor((new Date(d.expiry).getTime() - Date.now()) / DAY);
      items.push({ truckId: t._id, regNumber: t.regNumber, doc, label, expiry: d.expiry, daysLeft, level: complianceLevel(daysLeft) });
    }
  }
  return items.sort((a, b) => a.daysLeft - b.daysLeft);
}

export async function executiveSummary(p: Period, opts: { includeOwner: boolean }) {
  return cached(`cache:analytics:exec:${opts.includeOwner}:${p.from.toISOString().slice(0, 10)}`, 120, async () => {
    const [pl, b, trucks, activeTrips, clients, aging] = await Promise.all([
      profitAndLoss(p),
      accountBalances(),
      Truck.find().select('status').lean(),
      Trip.countDocuments({ status: { $in: ['ASSIGNED', 'LOADED', 'IN_TRANSIT'] } }),
      Client.find().select('creditLimit currentOutstanding').lean(),
      receivablesAging(),
    ]);
    const utilisation = trucks.filter((t) => t.status === 'ON_TRIP').length / Math.max(1, trucks.length);
    const tripsInPeriod = await Trip.find({ unloadedAt: { $gte: p.from, $lt: p.to } }).select('distanceKm economics').lean();
    const km = tripsInPeriod.reduce((s, t) => s + t.distanceKm, 0);
    return {
      period: p,
      revenue: pl.revenue,
      netProfit: pl.netProfit,
      ebitda: pl.ebitda,
      marginPct: pl.marginPct,
      directCost: pl.directTotal,
      overheads: pl.overheadTotal,
      revenuePerKm: km ? r2(pl.revenue / km) : 0,
      costPerKm: km ? r2((pl.directTotal + pl.overheadTotal) / km) : 0,
      totalKm: km,
      trips: tripsInPeriod.length,
      activeTrips,
      fleetSize: trucks.length,
      fleetUtilisation: r2(utilisation * 100),
      fleetStatus: ['AVAILABLE', 'ON_TRIP', 'MAINTENANCE', 'BREAKDOWN'].map((s) => ({ status: s, count: trucks.filter((t) => t.status === s).length })),
      receivables: bal(b, 'ACCOUNTS_RECEIVABLE'),
      payables: bal(b, 'PUMP_PAYABLE') + bal(b, 'WORKSHOP_PAYABLE') + bal(b, 'BROKER_PAYABLE'),
      overdue90: aging.buckets.find((x) => x.bucket === '90+')?.amount ?? 0,
      clientsOverLimit: clients.filter((c) => c.currentOutstanding > c.creditLimit).length,
      ...(opts.includeOwner
        ? { bankBalance: bal(b, 'BANK'), cashInHand: bal(b, 'CASH'), ownerEquity: bal(b, 'OWNER_EQUITY'), ownerDrawings: b.OWNER_EQUITY?.debit ?? 0, loanOutstanding: bal(b, 'LOAN_PAYABLE') }
        : {}),
    };
  });
}

/** Monthly revenue vs cost trend (from ledger). */
export async function monthlyTrend() {
  const rows = await LedgerEntry.aggregate<{ _id: { m: string; a: Account }; debit: number; credit: number }>([
    { $group: { _id: { m: { $dateToString: { format: '%Y-%m', date: '$date' } }, a: '$account' }, debit: { $sum: '$debit' }, credit: { $sum: '$credit' } } },
  ]);
  const months = new Map<string, { month: string; revenue: number; expense: number }>();
  for (const r of rows) {
    const cls = ACCOUNT_CLASS[r._id.a];
    const m = months.get(r._id.m) ?? { month: r._id.m, revenue: 0, expense: 0 };
    if (cls === 'REVENUE') m.revenue += r.credit - r.debit;
    if (cls === 'EXPENSE') m.expense += r.debit - r.credit;
    months.set(r._id.m, m);
  }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).map((m) => ({ ...m, revenue: Math.round(m.revenue), expense: Math.round(m.expense), profit: Math.round(m.revenue - m.expense) }));
}
