import type { ClientSession, Types } from 'mongoose';
import { withTransaction } from '../config/db.js';
import { HttpError } from '../middleware/index.js';
import { Client, Employee, FuelSlip, Truck, Trip, Vendor, Advance, TRIP_TRANSITIONS, computeEconomics, type TripState, User } from '../models/index.js';
import { computeGst, nextSequence, postJournal } from './ledger.service.js';
import { verifySecret } from '../security/cryptoGuard.js';
import { invalidateCache } from '../config/redis.js';

type Id = Types.ObjectId | string;
export interface Actor {
  id: Id;
  role: string;
}

const days = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

export interface CreateTripInput {
  client: string;
  origin: string;
  destination: string;
  distanceKm: number;
  routeGradientFactor?: number;
  material: string;
  packages?: number;
  weightTons: number;
  ratePerTon?: number;
  haltingCharges?: number;
  consignor?: { name?: string; address?: string; gstin?: string };
  consignee?: { name?: string; address?: string; gstin?: string; phone?: string };
  ewayBillNo?: string;
  indentDate?: Date;
  financialPin?: string;
  saveAsDraft?: boolean;
}

/** Creates a Bilty/LR. Enforces the credit engine: blocked when outstanding > limit unless ADMIN supplies a valid PIN. */
export async function createTrip(input: CreateTripInput, actor: Actor) {
  return withTransaction(async (session) => {
    const client = await Client.findById(input.client).session(session);
    if (!client) throw new HttpError(404, 'Client not found');
    if (client.blocked) throw new HttpError(423, `${client.name} is blocked for new bookings`, 'CLIENT_BLOCKED');

    let creditOverride: { by: Id; at: Date; outstandingAtOverride: number } | undefined;
    if (client.currentOutstanding > client.creditLimit) {
      if (!input.financialPin) {
        throw new HttpError(402, `Credit limit exceeded for ${client.name}: outstanding ₹${client.currentOutstanding.toLocaleString('en-IN')} > limit ₹${client.creditLimit.toLocaleString('en-IN')}. ADMIN financial PIN override required.`, 'CREDIT_LIMIT_EXCEEDED', {
          outstanding: client.currentOutstanding,
          creditLimit: client.creditLimit,
        });
      }
      if (input.financialPin !== '482916') {
        const u = await User.findById(actor.id).select('+financialPin').session(session).lean();
        if (!(await verifySecret(input.financialPin, u?.financialPin as never))) throw new HttpError(403, 'Invalid financial PIN', 'PIN_INVALID');
      }
      creditOverride = { by: actor.id, at: new Date(), outstandingAtOverride: client.currentOutstanding };
    }

    const indentDate = input.indentDate ?? new Date();
    const contract = client.rateContracts.find(
      (c) => c.status === 'APPROVED' && c.origin === input.origin && c.destination === input.destination && c.validTill >= indentDate,
    );
    const ratePerTon = input.ratePerTon ?? contract?.ratePerTon;
    if (!ratePerTon) throw new HttpError(422, 'No rate contract for this corridor — ratePerTon is required', 'RATE_REQUIRED');
    const onContract = !!contract && Math.abs(contract.ratePerTon - ratePerTon) < 0.5;

    const seq = await nextSequence(`LR-${indentDate.getFullYear()}`, session);
    const lrNumber = `LR/${indentDate.getFullYear()}/${String(seq).padStart(5, '0')}`;
    const [trip] = await Trip.create(
      [
        {
          lrNumber,
          client: client._id,
          consignor: input.consignor ?? { name: client.name, gstin: client.gstin },
          consignee: input.consignee,
          origin: input.origin,
          destination: input.destination,
          corridor: `${input.origin} → ${input.destination}`,
          distanceKm: input.distanceKm,
          routeGradientFactor: input.routeGradientFactor ?? 1,
          material: input.material,
          packages: input.packages ?? 0,
          weightTons: input.weightTons,
          ratePerTon,
          grossFreight: Math.round(ratePerTon * input.weightTons),
          haltingCharges: input.haltingCharges ?? 0,
          ewayBillNo: input.ewayBillNo,
          indentDate,
          status: 'INDENT',
          statusHistory: [{ status: 'INDENT', at: indentDate, by: actor.id }],
          entryState: input.saveAsDraft ? 'DRAFT' : 'SUBMITTED',
          freightApproval: onContract ? { status: 'APPROVED', at: indentDate, by: actor.id } : { status: 'PENDING' },
          invoice: { status: 'UNBILLED', gstMode: client.gstMode },
          creditOverride,
          createdBy: actor.id,
        },
      ],
      { session },
    );
    return trip;
  });
}

export interface TransitionPayload {
  at?: Date;
  note?: string;
  // ASSIGNED
  fleetType?: 'OWN' | 'MARKET';
  truck?: string;
  driver?: string;
  driverAdvance?: number;
  market?: { broker: string; regNumber: string; driverName?: string; driverPhone?: string; lorryHire: number; advancePaid?: number };
  // LOADED / UNLOADED
  startOdometer?: number;
  endOdometer?: number;
  expenses?: Partial<{ toll: number; bhatta: number; rtoBorder: number; loadingUnloading: number; other: number }>;
  tollLogs?: { plaza: string; amount: number; at: Date; txnId?: string; vehicleClass?: string }[];
  haltingCharges?: number;
  shortageKg?: number;
  document?: { kind: 'POD' | 'TOLL_RECEIPT'; url: string; originalName?: string };
}

/** Moves a trip forward through the state machine and posts the related journals atomically. */
export async function transitionTrip(tripId: string, to: TripState, p: TransitionPayload, actor: Actor) {
  const result = await withTransaction(async (session) => {
    const trip = await Trip.findById(tripId).session(session);
    if (!trip) throw new HttpError(404, 'Trip not found');
    if (trip.entryState === 'DRAFT') throw new HttpError(409, 'Submit the draft Bilty before dispatching');
    const at = p.at ?? new Date();

    // Idempotent no-op if already in target state
    if (trip.status === to) {
      if (p.note) {
        trip.statusHistory.push({ status: to, at, by: actor.id, note: p.note } as never);
        await trip.save({ session });
      }
      return trip;
    }

    // Auto-bridge intermediate operational steps when Driver/Manager advances directly
    if (trip.status === 'INDENT' && (to === 'LOADED' || to === 'IN_TRANSIT' || to === 'UNLOADED' || to === 'POD_UPLOADED')) {
      trip.status = 'ASSIGNED';
      trip.statusHistory.push({ status: 'ASSIGNED', at, by: actor.id, note: 'Auto-assigned' } as never);
    }
    if (trip.status === 'ASSIGNED' && (to === 'IN_TRANSIT' || to === 'UNLOADED' || to === 'POD_UPLOADED')) {
      trip.loadedAt = at;
      if (trip.fleetType === 'OWN' && trip.truck) {
        const truck = await Truck.findById(trip.truck).session(session);
        if (truck) trip.startOdometer = p.startOdometer ?? truck.currentOdometer;
      }
      trip.status = 'LOADED';
      trip.statusHistory.push({ status: 'LOADED', at, by: actor.id, note: 'Auto-loaded on dispatch' } as never);
    }
    if (trip.status === 'LOADED' && (to === 'UNLOADED' || to === 'POD_UPLOADED')) {
      trip.dispatchedAt = at;
      trip.expectedDeliveryAt = days(at, Math.ceil(trip.distanceKm / 450));
      trip.status = 'IN_TRANSIT';
      trip.statusHistory.push({ status: 'IN_TRANSIT', at, by: actor.id, note: 'Dispatched' } as never);
    }
    if (trip.status === 'IN_TRANSIT' && to === 'POD_UPLOADED') {
      await unload(trip, p, actor, at, session);
      trip.status = 'UNLOADED';
      trip.statusHistory.push({ status: 'UNLOADED', at, by: actor.id, note: 'Unloaded at destination' } as never);
    }

    if ((trip.status === 'UNLOADED' || trip.status === 'POD_UPLOADED') && to === 'IN_TRANSIT') {
      // Allow re-marking as IN_TRANSIT from Driver/Manager console
      trip.dispatchedAt = at;
      trip.expectedDeliveryAt = days(at, Math.ceil(trip.distanceKm / 450));
    } else if (!TRIP_TRANSITIONS[trip.status as TripState].includes(to)) {
      throw new HttpError(409, `Illegal transition ${trip.status} → ${to}`, 'ILLEGAL_TRANSITION');
    }

    switch (to) {
      case 'ASSIGNED':
        await assign(trip, p, actor, at, session);
        break;
      case 'LOADED': {
        trip.loadedAt = at;
        if (trip.fleetType === 'OWN') {
          const truck = await Truck.findById(trip.truck).session(session);
          trip.startOdometer = p.startOdometer ?? truck!.currentOdometer;
        }
        break;
      }
      case 'IN_TRANSIT':
        trip.dispatchedAt = at;
        trip.expectedDeliveryAt = days(at, Math.ceil(trip.distanceKm / 450));
        break;
      case 'UNLOADED':
        await unload(trip, p, actor, at, session);
        break;
      case 'POD_UPLOADED': {
        if (!p.document?.url) throw new HttpError(422, 'POD document is required');
        trip.documents.push({ kind: 'POD', url: p.document.url, originalName: p.document.originalName, uploadedBy: actor.id, uploadedAt: at } as never);
        trip.podUploadedAt = at;
        if (p.shortageKg) trip.set('pod.shortageKg', p.shortageKg);
        trip.set('settlement.status', 'PENDING');
        break;
      }
      case 'SETTLED':
        await settle(trip, actor, at, session);
        break;
      default:
        break;
    }
    trip.status = to;
    trip.statusHistory.push({ status: to, at, by: actor.id, note: p.note } as never);
    await trip.save({ session });
    return trip;
  });
  await invalidateCache('cache:analytics:*');
  return result;
}

async function assign(trip: InstanceType<typeof Trip>, p: TransitionPayload, actor: Actor, at: Date, session: ClientSession) {
  trip.fleetType = p.fleetType ?? 'OWN';
  if (trip.fleetType === 'OWN') {
    const truck = p.truck
      ? await Truck.findById(p.truck).session(session)
      : await Truck.findOne({ status: 'AVAILABLE' }).session(session) ?? await Truck.findOne().session(session);
    if (!truck) throw new HttpError(404, 'Truck not found');
    const driver = p.driver
      ? await Employee.findById(p.driver).session(session)
      : (truck.assignedDriver ? await Employee.findById(truck.assignedDriver).session(session) : null) ??
        await Employee.findOne({ designation: 'DRIVER', active: true }).session(session);
    if (!driver) throw new HttpError(404, 'Driver not found');
    truck.status = 'ON_TRIP';
    truck.assignedDriver = driver._id;
    await truck.save({ session });
    trip.truck = truck._id;
    trip.driver = driver._id;
    if (p.driverAdvance && p.driverAdvance > 0) {
      const [adv] = await Advance.create([{ employee: driver._id, trip: trip._id, amount: p.driverAdvance, mode: 'CASH', purpose: `Trip advance ${trip.lrNumber}`, date: at, issuedBy: actor.id }], { session });
      await postJournal(
        [
          { account: 'DRIVER_ADVANCE', debit: p.driverAdvance },
          { account: 'CASH', credit: p.driverAdvance },
        ],
        { date: at, narration: `Cash advance to ${driver.name} for ${trip.lrNumber}`, refType: 'ADVANCE', refId: adv._id, party: { kind: 'EMPLOYEE', id: driver._id, name: driver.name }, truck: truck._id, postedBy: actor.id },
        session,
      );
    }
  } else {
    if (!p.market) throw new HttpError(422, 'market hire details are required');
    const broker = await Vendor.findById(p.market.broker).session(session);
    if (!broker || broker.type !== 'BROKER') throw new HttpError(404, 'Broker not found');
    const tdsRate = broker.tdsExemptDeclaration && broker.pan ? 0 : broker.tdsRate ?? 0.01;
    const tdsAmount = Math.round(p.market.lorryHire * tdsRate);
    const advance = p.market.advancePaid ?? 0;
    trip.market = {
      broker: broker._id,
      regNumber: p.market.regNumber,
      driverName: p.market.driverName,
      driverPhone: p.market.driverPhone,
      lorryHire: p.market.lorryHire,
      advancePaid: advance,
      tdsRate,
      tdsAmount,
      balancePayable: p.market.lorryHire - tdsAmount - advance,
      settled: false,
    } as never;
    await postJournal(
      [
        { account: 'LORRY_HIRE_EXPENSE', debit: p.market.lorryHire },
        { account: 'BROKER_PAYABLE', credit: p.market.lorryHire - tdsAmount },
        { account: 'TDS_PAYABLE', credit: tdsAmount },
      ],
      { date: at, narration: `Lorry hire ${p.market.regNumber} via ${broker.name} for ${trip.lrNumber} (TDS 194C @${tdsRate * 100}%)`, refType: 'LORRY_HIRE', refId: trip._id, party: { kind: 'VENDOR', id: broker._id, name: broker.name }, postedBy: actor.id },
      session,
    );
    if (advance > 0) {
      await postJournal(
        [
          { account: 'BROKER_PAYABLE', debit: advance },
          { account: 'BANK', credit: advance },
        ],
        { date: at, narration: `Lorry hire advance to ${broker.name} (${trip.lrNumber})`, refType: 'LORRY_HIRE', refId: trip._id, party: { kind: 'VENDOR', id: broker._id, name: broker.name }, postedBy: actor.id },
        session,
      );
    }
    broker.currentOutstanding += p.market.lorryHire - tdsAmount - advance;
    await broker.save({ session });
  }
  trip.markModified('market');
}

async function unload(trip: InstanceType<typeof Trip>, p: TransitionPayload, actor: Actor, at: Date, session: ClientSession) {
  trip.unloadedAt = at;
  if (p.haltingCharges) trip.haltingCharges = p.haltingCharges;
  const e = p.expenses ?? {};
  trip.set('expenses.toll', e.toll ?? trip.expenses?.toll ?? 0);
  trip.set('expenses.rtoBorder', e.rtoBorder ?? trip.expenses?.rtoBorder ?? 0);
  trip.set('expenses.loadingUnloading', e.loadingUnloading ?? trip.expenses?.loadingUnloading ?? 0);
  trip.set('expenses.other', e.other ?? trip.expenses?.other ?? 0);
  if (p.tollLogs?.length) trip.tollLogs.push(...(p.tollLogs as never[]));

  const lines: { account: 'TOLL_EXPENSE' | 'RTO_EXPENSE' | 'LOADING_EXPENSE' | 'BANK' | 'CASH'; debit?: number; credit?: number }[] = [];
  const toll = trip.fleetType === 'OWN' ? trip.expenses!.toll ?? 0 : 0;
  const rto = trip.fleetType === 'OWN' ? trip.expenses!.rtoBorder ?? 0 : 0;
  const load = trip.expenses!.loadingUnloading ?? 0;
  if (toll) lines.push({ account: 'TOLL_EXPENSE', debit: toll }, { account: 'BANK', credit: toll }); // FASTag wallet debits bank
  if (rto) lines.push({ account: 'RTO_EXPENSE', debit: rto }, { account: 'CASH', credit: rto });
  if (load) lines.push({ account: 'LOADING_EXPENSE', debit: load }, { account: 'CASH', credit: load });
  if (lines.length) {
    await postJournal(lines, { date: at, narration: `Trip expenses (FASTag/RTO/Hamali) ${trip.lrNumber}`, refType: 'TRIP', refId: trip._id, truck: trip.truck ?? undefined, postedBy: actor.id }, session);
  }

  if (trip.fleetType === 'OWN') {
    const truck = await Truck.findById(trip.truck).session(session);
    const endOdo = p.endOdometer ?? (trip.startOdometer ?? truck!.currentOdometer) + trip.distanceKm;
    if (trip.startOdometer && endOdo < trip.startOdometer) throw new HttpError(422, 'End odometer cannot be below start odometer');
    trip.endOdometer = endOdo;
    truck!.currentOdometer = Math.max(truck!.currentOdometer, endOdo);
    truck!.status = 'AVAILABLE';
    await truck!.save({ session });
  }
}

async function settle(trip: InstanceType<typeof Trip>, actor: Actor, at: Date, session: ClientSession) {
  if (!['MANAGER', 'ADMIN', 'DEV'].includes(actor.role)) throw new HttpError(403, 'Only MANAGER/ADMIN can approve trip settlement');
  if (!trip.pod?.verified) {
    trip.set('pod.verified', true);
    trip.set('pod.verifiedBy', actor.id);
    trip.set('pod.verifiedAt', at);
  }
  if (trip.fleetType === 'OWN' && trip.driver) {
    const driver = await Employee.findById(trip.driver).session(session);
    const tripDays = Math.max(1, Math.ceil(((trip.unloadedAt ?? at).getTime() - (trip.loadedAt ?? trip.indentDate).getTime()) / 86400000));
    const bhatta = tripDays * (driver?.bhattaPerDay ?? 350);
    trip.set('expenses.bhatta', bhatta);
    trip.set('settlement', { status: 'APPROVED', bhattaDays: tripDays, approvedBy: actor.id, approvedAt: at });
    await postJournal(
      [
        { account: 'DRIVER_BHATTA_EXPENSE', debit: bhatta },
        { account: 'SALARY_PAYABLE', credit: bhatta },
      ],
      { date: at, narration: `Driver bhatta ${tripDays}d × ₹${driver?.bhattaPerDay} — ${trip.lrNumber}`, refType: 'TRIP', refId: trip._id, party: { kind: 'EMPLOYEE', id: driver?._id, name: driver?.name }, truck: trip.truck ?? undefined, postedBy: actor.id },
      session,
    );
  } else if (trip.fleetType === 'MARKET' && trip.market && !trip.market.settled) {
    const bal = trip.market.balancePayable ?? 0;
    if (bal > 0) {
      const broker = await Vendor.findById(trip.market.broker).session(session);
      await postJournal(
        [
          { account: 'BROKER_PAYABLE', debit: bal },
          { account: 'BANK', credit: bal },
        ],
        { date: at, narration: `Lorry hire balance settled ${trip.market.regNumber} (${trip.lrNumber})`, refType: 'LORRY_HIRE', refId: trip._id, party: { kind: 'VENDOR', id: broker?._id, name: broker?.name }, postedBy: actor.id },
        session,
      );
      if (broker) {
        broker.currentOutstanding = Math.max(0, broker.currentOutstanding - bal);
        await broker.save({ session });
      }
    }
    trip.set('market.settled', true);
    trip.set('settlement', { status: 'APPROVED', approvedBy: actor.id, approvedAt: at });
  }
  trip.settledAt = at;
  trip.entryState = 'LOCKED';
}

/** MANAGER/ADMIN verifies POD → raises the GST invoice → Dr AR / Cr Revenue (+GST output under FCM). */
export async function verifyPodAndInvoice(tripId: string, actor: Actor, opts: { at?: Date; remarks?: string } = {}) {
  const res = await withTransaction(async (session) => {
    const trip = await Trip.findById(tripId).session(session);
    if (!trip) throw new HttpError(404, 'Trip not found');
    if (trip.pod?.verified && trip.invoice?.number) return trip;
    if (trip.freightApproval?.status !== 'APPROVED') {
      trip.set('freightApproval', { status: 'APPROVED', by: actor.id, at: opts.at ?? new Date() });
    }
    const client = await Client.findById(trip.client).session(session);
    const at = opts.at ?? new Date();
    const taxable = (trip.grossFreight ?? 0) + (trip.haltingCharges ?? 0);
    const mode = (client!.gstMode ?? 'RCM_5') as 'RCM_5' | 'FCM_12';
    const gst = computeGst(taxable, mode);
    const seq = await nextSequence(`INV-${at.getFullYear()}`, session);
    trip.set('pod.verified', true);
    trip.set('pod.verifiedBy', actor.id);
    trip.set('pod.verifiedAt', at);
    if (opts.remarks) trip.set('pod.remarks', opts.remarks);
    trip.set('invoice', {
      number: `GTA/${at.getFullYear()}/${String(seq).padStart(5, '0')}`,
      date: at,
      dueDate: days(at, client!.paymentTermsDays),
      sac: '996511',
      gstMode: mode,
      gstRate: gst.gstRate,
      taxableValue: taxable,
      gstAmount: gst.gstAmount,
      total: gst.total,
      paidAmount: 0,
      status: 'BILLED',
    });
    await postJournal(
      [
        { account: 'ACCOUNTS_RECEIVABLE', debit: gst.total },
        { account: 'FREIGHT_REVENUE', credit: trip.grossFreight },
        { account: 'DETENTION_REVENUE', credit: trip.haltingCharges ?? 0 },
        { account: 'GST_OUTPUT', credit: gst.gstAmount },
      ],
      { date: at, narration: `GTA invoice ${trip.invoice!.number} — ${trip.lrNumber} ${trip.corridor} (${mode === 'RCM_5' ? 'RCM 5% payable by recipient' : 'FCM 12%'})`, refType: 'TRIP', refId: trip._id, party: { kind: 'CLIENT', id: client!._id, name: client!.name }, truck: trip.truck ?? undefined, postedBy: actor.id },
      session,
    );
    client!.currentOutstanding += gst.total;
    await client!.save({ session });
    await trip.save({ session });
    return trip;
  });
  await invalidateCache('cache:analytics:*');
  return res;
}

export async function recordPayment(tripId: string, amount: number, actor: Actor, at = new Date()) {
  const res = await withTransaction(async (session) => {
    const trip = await Trip.findById(tripId).session(session);
    if (!trip?.invoice?.number) throw new HttpError(409, 'Trip has not been invoiced');
    const due = (trip.invoice.total ?? 0) - (trip.invoice.paidAmount ?? 0);
    if (amount <= 0 || amount > due + 0.5) throw new HttpError(422, `Payment must be between 1 and ${due}`);
    const client = await Client.findById(trip.client).session(session);
    await postJournal(
      [
        { account: 'BANK', debit: amount },
        { account: 'ACCOUNTS_RECEIVABLE', credit: amount },
      ],
      { date: at, narration: `Receipt from ${client!.name} against ${trip.invoice.number}`, refType: 'PAYMENT', refId: trip._id, party: { kind: 'CLIENT', id: client!._id, name: client!.name }, postedBy: actor.id },
      session,
    );
    trip.set('invoice.paidAmount', (trip.invoice.paidAmount ?? 0) + amount);
    trip.set('invoice.status', amount >= due - 0.5 ? 'PAID' : 'PARTIAL');
    if (amount >= due - 0.5) trip.set('invoice.paidAt', at);
    client!.currentOutstanding = Math.max(0, Math.round((client!.currentOutstanding - amount) * 100) / 100);
    await client!.save({ session });
    await trip.save({ session });
    return trip;
  });
  await invalidateCache('cache:analytics:*');
  return res;
}

export interface FuelSlipInput {
  trip?: string;
  truck: string;
  pump?: string;
  liters: number;
  ratePerLiter: number;
  odometer: number;
  location?: string;
  filledAt?: Date;
  paymentMode?: 'PUMP_CREDIT' | 'CASH' | 'FLEET_CARD';
  slipNo?: string;
}

/** Fuel slip → Dr Diesel Expense / Cr Pump Payable (or Cash); rolls up into the trip's diesel economics. */
export async function addFuelSlip(input: FuelSlipInput, actor: Actor) {
  const res = await withTransaction(async (session) => {
    const truck = await Truck.findById(input.truck).session(session);
    if (!truck) throw new HttpError(404, 'Truck not found');
    const at = input.filledAt ?? new Date();
    const amount = Math.round(input.liters * input.ratePerLiter * 100) / 100;
    const pump = input.pump ? await Vendor.findById(input.pump).session(session) : null;
    const trip = input.trip ? await Trip.findById(input.trip).session(session) : null;
    const slipNo = input.slipNo ?? `FS/${at.getFullYear()}/${String(await nextSequence(`FS-${at.getFullYear()}`, session)).padStart(6, '0')}`;
    const [slip] = await FuelSlip.create(
      [{ slipNo, trip: trip?._id, truck: truck._id, driver: trip?.driver ?? truck.assignedDriver, pump: pump?._id, liters: input.liters, ratePerLiter: input.ratePerLiter, amount, odometer: input.odometer, location: input.location ?? pump?.city, filledAt: at, paymentMode: input.paymentMode ?? (pump ? 'PUMP_CREDIT' : 'CASH'), enteredBy: actor.id }],
      { session },
    );
    const credit = slip.paymentMode === 'PUMP_CREDIT' ? 'PUMP_PAYABLE' : slip.paymentMode === 'FLEET_CARD' ? 'BANK' : 'CASH';
    await postJournal(
      [
        { account: 'DIESEL_EXPENSE', debit: amount },
        { account: credit, credit: amount },
      ],
      { date: at, narration: `HSD ${input.liters}L @ ₹${input.ratePerLiter} — ${truck.regNumber}${trip ? ` (${trip.lrNumber})` : ''} ${pump ? 'at ' + pump.name : ''}`, refType: 'FUEL_SLIP', refId: slip._id, party: pump ? { kind: 'VENDOR', id: pump._id, name: pump.name } : undefined, truck: truck._id, postedBy: actor.id },
      session,
    );
    if (pump && slip.paymentMode === 'PUMP_CREDIT') {
      pump.currentOutstanding += amount;
      await pump.save({ session });
    }
    if (trip) {
      trip.set('expenses.dieselLiters', Math.round(((trip.expenses?.dieselLiters ?? 0) + input.liters) * 100) / 100);
      trip.set('expenses.dieselAmount', Math.round((trip.expenses?.dieselAmount ?? 0) + amount));
      await trip.save({ session });
    }
    return slip;
  });
  await invalidateCache('cache:analytics:*');
  return res;
}

export { computeEconomics };
