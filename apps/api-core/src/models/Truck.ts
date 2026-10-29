import { Schema, model, type InferSchemaType } from 'mongoose';

export const AXLE_CONFIGS = ['6W', '10W', '12W', '14W', '16W'] as const;
export const TRUCK_STATUS = ['AVAILABLE', 'ON_TRIP', 'MAINTENANCE', 'BREAKDOWN'] as const;
export const TYRE_POSITIONS = ['FL', 'FR', 'RLO', 'RLI', 'RRO', 'RRI', 'TLO', 'TLI', 'TRO', 'TRI', 'STEPNEY'] as const;
export const COMPLIANCE_DOCS = ['insurance', 'fitness', 'nationalPermit', 'puc', 'stateTax'] as const;

const ComplianceDocSchema = new Schema(
  { number: String, issuer: String, expiry: { type: Date, required: true }, premium: { type: Number, default: 0 } },
  { _id: false },
);

const TruckSchema = new Schema(
  {
    regNumber: { type: String, required: true, unique: true, uppercase: true, match: /^[A-Z]{2}-\d{2}-[A-Z]{1,3}-\d{4}$/ },
    chassisNo: { type: String, required: true, unique: true },
    engineNo: { type: String, required: true },
    make: { type: String, required: true },
    model: { type: String, required: true },
    manufactureYear: { type: Number, required: true },
    axleConfig: { type: String, enum: AXLE_CONFIGS, required: true },
    bodyType: { type: String, enum: ['OPEN', 'CONTAINER', 'TRAILER', 'TANKER', 'TIPPER'], default: 'OPEN' },
    capacityTons: { type: Number, required: true },
    purchasePrice: { type: Number, required: true },
    emiAmount: { type: Number, default: 0 },
    emiDayOfMonth: { type: Number, min: 1, max: 28, default: 5 },
    emiLender: { type: String },
    currentOdometer: { type: Number, required: true, min: 0 },
    baselineKmpl: { type: Number, required: true }, // OEM rated loaded mileage
    status: { type: String, enum: TRUCK_STATUS, default: 'AVAILABLE', index: true },
    assignedDriver: { type: Schema.Types.ObjectId, ref: 'Employee' },
    gpsDeviceId: { type: String },
    fastagId: { type: String },
    compliance: {
      insurance: { type: ComplianceDocSchema, required: true },
      fitness: { type: ComplianceDocSchema, required: true },
      nationalPermit: { type: ComplianceDocSchema, required: true },
      puc: { type: ComplianceDocSchema, required: true },
      stateTax: { type: ComplianceDocSchema, required: true },
    },
    lastServiceOdometer: { type: Number, default: 0 },
    componentService: {
      BRAKE_PAD: { type: Number, default: 0 },
      CLUTCH_PLATE: { type: Number, default: 0 },
      ENGINE_OIL: { type: Number, default: 0 },
      TYRE: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

export type TruckT = InferSchemaType<typeof TruckSchema>;
export const Truck = model('Truck', TruckSchema);

/** Every tyre is tracked by serial number across its lifetime to prevent highway tyre-swap theft. */
const TyreHistorySchema = new Schema(
  {
    truck: { type: Schema.Types.ObjectId, ref: 'Truck' },
    position: { type: String, enum: TYRE_POSITIONS },
    fittedAt: Date,
    removedAt: Date,
    odoIn: Number,
    odoOut: Number,
    reason: String,
  },
  { _id: false },
);

const TyreSchema = new Schema(
  {
    serialNo: { type: String, required: true, unique: true, uppercase: true },
    brand: { type: String, required: true },
    model: { type: String },
    size: { type: String, default: '295/80 R22.5' },
    purchaseCost: { type: Number, required: true },
    purchaseDate: { type: Date, required: true },
    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    originalTreadMm: { type: Number, default: 16 },
    treadDepthMm: { type: Number, required: true },
    retreadCount: { type: Number, default: 0 },
    status: { type: String, enum: ['FITTED', 'STOCK', 'RETREAD', 'SCRAPPED'], default: 'FITTED', index: true },
    currentTruck: { type: Schema.Types.ObjectId, ref: 'Truck', index: true },
    currentPosition: { type: String, enum: TYRE_POSITIONS },
    fittedOdometer: { type: Number },
    totalKmRun: { type: Number, default: 0 },
    history: [TyreHistorySchema],
  },
  { timestamps: true },
);

export type TyreT = InferSchemaType<typeof TyreSchema>;
export const Tyre = model('Tyre', TyreSchema);
