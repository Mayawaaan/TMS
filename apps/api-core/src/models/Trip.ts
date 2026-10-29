import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const TRIP_STATES = ['INDENT', 'ASSIGNED', 'LOADED', 'IN_TRANSIT', 'UNLOADED', 'POD_UPLOADED', 'SETTLED'] as const;
export type TripState = (typeof TRIP_STATES)[number];

/** Allowed forward transitions of the Bilty / trip state machine. */
export const TRIP_TRANSITIONS: Record<TripState, TripState[]> = {
  INDENT: ['ASSIGNED'],
  ASSIGNED: ['LOADED'],
  LOADED: ['IN_TRANSIT'],
  IN_TRANSIT: ['UNLOADED'],
  UNLOADED: ['POD_UPLOADED'],
  POD_UPLOADED: ['SETTLED'],
  SETTLED: [],
};

const TollLogSchema = new Schema(
  { plaza: String, amount: Number, at: Date, txnId: String, vehicleClass: String },
  { _id: false },
);

const DocumentSchema = new Schema(
  {
    kind: { type: String, enum: ['POD', 'TOLL_RECEIPT', 'FUEL_RECEIPT', 'WEIGHBRIDGE', 'EWAY_BILL'] },
    url: String,
    originalName: String,
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const TripSchema = new Schema(
  {
    lrNumber: { type: String, required: true, unique: true },
    client: { type: Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
    consignor: { name: String, address: String, gstin: String },
    consignee: { name: String, address: String, gstin: String, phone: String },
    origin: { type: String, required: true },
    destination: { type: String, required: true },
    corridor: { type: String, required: true, index: true },
    distanceKm: { type: Number, required: true, min: 1 },
    routeGradientFactor: { type: Number, default: 1.0 }, // 1.0 plains … 1.35 ghats
    material: { type: String, required: true },
    packages: { type: Number, default: 0 },
    weightTons: { type: Number, required: true, min: 0.1 },
    ratePerTon: { type: Number, required: true, min: 0 },
    grossFreight: { type: Number, required: true, min: 0 },
    haltingCharges: { type: Number, default: 0 },
    ewayBillNo: String,

    fleetType: { type: String, enum: ['OWN', 'MARKET'], default: 'OWN' },
    truck: { type: Schema.Types.ObjectId, ref: 'Truck', index: true },
    driver: { type: Schema.Types.ObjectId, ref: 'Employee', index: true },
    market: {
      broker: { type: Schema.Types.ObjectId, ref: 'Vendor' },
      regNumber: String,
      driverName: String,
      driverPhone: String,
      lorryHire: Number,
      advancePaid: Number,
      tdsRate: Number,
      tdsAmount: Number,
      balancePayable: Number,
      settled: { type: Boolean, default: false },
    },

    status: { type: String, enum: TRIP_STATES, default: 'INDENT', index: true },
    statusHistory: [
      { status: { type: String, enum: TRIP_STATES }, at: Date, by: { type: Schema.Types.ObjectId, ref: 'User' }, note: String, _id: false },
    ],
    indentDate: { type: Date, required: true, index: true },
    loadedAt: Date,
    dispatchedAt: Date,
    expectedDeliveryAt: Date,
    unloadedAt: Date,
    podUploadedAt: Date,
    settledAt: Date,

    startOdometer: Number,
    endOdometer: Number,

    expenses: {
      dieselLiters: { type: Number, default: 0 },
      dieselAmount: { type: Number, default: 0 },
      toll: { type: Number, default: 0 },
      bhatta: { type: Number, default: 0 },
      rtoBorder: { type: Number, default: 0 },
      loadingUnloading: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
    },
    tollLogs: [TollLogSchema],
    documents: [DocumentSchema],

    pod: {
      verified: { type: Boolean, default: false },
      verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      verifiedAt: Date,
      remarks: String,
      shortageKg: { type: Number, default: 0 },
    },

    invoice: {
      number: String,
      date: Date,
      dueDate: Date,
      sac: { type: String, default: '996511' }, // GTA road transport of goods
      gstMode: { type: String, enum: ['RCM_5', 'FCM_12'] },
      gstRate: Number,
      taxableValue: Number,
      gstAmount: Number, // charged on invoice only under FCM; RCM liability sits with recipient
      total: Number,
      paidAmount: { type: Number, default: 0 },
      paidAt: Date,
      status: { type: String, enum: ['UNBILLED', 'BILLED', 'PARTIAL', 'PAID'], default: 'UNBILLED', index: true },
    },

    freightApproval: {
      status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
      by: { type: Schema.Types.ObjectId, ref: 'User' },
      at: Date,
      aiFloorRate: Number,
      aiOptimalRate: Number,
    },
    settlement: {
      status: { type: String, enum: ['NOT_DUE', 'PENDING', 'APPROVED'], default: 'NOT_DUE' },
      bhattaDays: Number,
      approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      approvedAt: Date,
    },
    /** STAFF create-only workflow: once SUBMITTED, only MANAGER/ADMIN may mutate. */
    entryState: { type: String, enum: ['DRAFT', 'SUBMITTED', 'LOCKED'], default: 'SUBMITTED' },
    creditOverride: { by: { type: Schema.Types.ObjectId, ref: 'User' }, at: Date, outstandingAtOverride: Number },

    aiAudit: {
      anomalyScore: Number,
      expectedKmpl: Number,
      actualKmpl: Number,
      isFlaggedForTheft: { type: Boolean, default: false },
      suspectedLitersSiphoned: Number,
      auditedAt: Date,
      modelVersion: String,
    },

    economics: {
      revenue: Number,
      directCost: Number,
      netProfit: Number,
      profitPerKm: Number,
      marginPct: Number,
      actualKmpl: Number,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

/** Net Trip Profit = (Gross Freight + Halting) − (Diesel + Toll + Bhatta + RTO/Border + Loading/Unloading [+ Lorry Hire for market trucks]) */
export function computeEconomics(t: {
  grossFreight: number;
  haltingCharges?: number | null;
  distanceKm: number;
  fleetType?: string | null;
  market?: { lorryHire?: number | null } | null;
  expenses?: Record<string, number | null | undefined> | null;
  startOdometer?: number | null;
  endOdometer?: number | null;
}) {
  const e = t.expenses ?? {};
  const revenue = (t.grossFreight ?? 0) + (t.haltingCharges ?? 0);
  const ownCost =
    (e.dieselAmount ?? 0) + (e.toll ?? 0) + (e.bhatta ?? 0) + (e.rtoBorder ?? 0) + (e.loadingUnloading ?? 0) + (e.other ?? 0);
  const directCost = t.fleetType === 'MARKET' ? (t.market?.lorryHire ?? 0) + (e.loadingUnloading ?? 0) : ownCost;
  const netProfit = revenue - directCost;
  const km = t.endOdometer && t.startOdometer ? t.endOdometer - t.startOdometer : t.distanceKm;
  const actualKmpl = e.dieselLiters ? +(km / (e.dieselLiters as number)).toFixed(2) : undefined;
  return {
    revenue: Math.round(revenue),
    directCost: Math.round(directCost),
    netProfit: Math.round(netProfit),
    profitPerKm: +(netProfit / Math.max(t.distanceKm, 1)).toFixed(2),
    marginPct: revenue ? +((netProfit / revenue) * 100).toFixed(2) : 0,
    actualKmpl,
  };
}

TripSchema.pre('save', function (next) {
  this.economics = computeEconomics(this as never);
  next();
});

TripSchema.index({ lrNumber: 'text', corridor: 'text', material: 'text' });

export type TripT = InferSchemaType<typeof TripSchema>;
export type TripDoc = HydratedDocument<TripT>;
export const Trip = model('Trip', TripSchema);
