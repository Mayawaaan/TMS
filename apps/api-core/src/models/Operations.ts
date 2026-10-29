import { Schema, model, type InferSchemaType } from 'mongoose';

export const COMPONENTS = [
  'BRAKE_PAD',
  'CLUTCH_PLATE',
  'ENGINE_OIL',
  'TYRE',
  'RTO_FITNESS',
  'NATIONAL_PERMIT',
  'STATE_TAX_CHALLAN',
  'OVERLOAD_CHALLAN',
  'PUC_INSURANCE',
  'GENERAL',
] as const;

const FuelSlipSchema = new Schema(
  {
    slipNo: { type: String, required: true, unique: true },
    trip: { type: Schema.Types.ObjectId, ref: 'Trip', index: true },
    truck: { type: Schema.Types.ObjectId, ref: 'Truck', required: true, index: true },
    driver: { type: Schema.Types.ObjectId, ref: 'Employee' },
    pump: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    liters: { type: Number, required: true, min: 1 },
    ratePerLiter: { type: Number, required: true, min: 50 },
    amount: { type: Number, required: true },
    odometer: { type: Number, required: true },
    location: String,
    filledAt: { type: Date, required: true, index: true },
    paymentMode: { type: String, enum: ['PUMP_CREDIT', 'CASH', 'FLEET_CARD'], default: 'PUMP_CREDIT' },
    state: { type: String, enum: ['SUBMITTED', 'APPROVED', 'REJECTED'], default: 'SUBMITTED' },
    enteredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    receiptUrl: String,
  },
  { timestamps: true },
);
export type FuelSlipT = InferSchemaType<typeof FuelSlipSchema>;
export const FuelSlip = model('FuelSlip', FuelSlipSchema);

const MaintenanceSchema = new Schema(
  {
    jobNo: { type: String, required: true, unique: true },
    truck: { type: Schema.Types.ObjectId, ref: 'Truck', required: true, index: true },
    type: { type: String, enum: ['SCHEDULED', 'BREAKDOWN'], required: true },
    component: { type: String, enum: COMPONENTS, default: 'GENERAL' },
    workshop: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    location: String,
    odometer: { type: Number, required: true },
    kmSinceLastService: Number,
    description: { type: String, required: true },
    parts: [{ name: String, partNo: String, qty: Number, unitCost: Number, _id: false }],
    labourCost: { type: Number, default: 0 },
    partsCost: { type: Number, default: 0 },
    totalCost: { type: Number, required: true },
    downtimeHours: { type: Number, default: 0 },
    date: { type: Date, required: true, index: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING', index: true },
    raisedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
  },
  { timestamps: true },
);
export type MaintenanceT = InferSchemaType<typeof MaintenanceSchema>;
export const Maintenance = model('Maintenance', MaintenanceSchema);
