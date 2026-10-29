import { Schema, model, type InferSchemaType } from 'mongoose';

const AdvanceSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    trip: { type: Schema.Types.ObjectId, ref: 'Trip' },
    amount: { type: Number, required: true, min: 1 },
    mode: { type: String, enum: ['CASH', 'UPI', 'DIESEL'], default: 'CASH' },
    purpose: { type: String, default: 'Trip advance' },
    date: { type: Date, required: true, index: true },
    issuedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    recovered: { type: Boolean, default: false },
    payslip: { type: Schema.Types.ObjectId, ref: 'Payslip' },
  },
  { timestamps: true },
);
export type AdvanceT = InferSchemaType<typeof AdvanceSchema>;
export const Advance = model('Advance', AdvanceSchema);

const AttendanceSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: { type: String, enum: ['PRESENT', 'ON_TRIP', 'ABSENT', 'LEAVE', 'HALF_DAY'], required: true },
    truck: { type: Schema.Types.ObjectId, ref: 'Truck' },
    markedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
AttendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
export const Attendance = model('Attendance', AttendanceSchema);

/** Net Payable = Base + Σ(Trip Bhatta) + (Total KM × KM Incentive) − Cash Advances − Fuel Shortage Penalties */
const PayslipSchema = new Schema(
  {
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    baseSalary: { type: Number, required: true },
    tripBhatta: { type: Number, default: 0 },
    totalKm: { type: Number, default: 0 },
    kmIncentiveRate: { type: Number, default: 0 },
    kmIncentive: { type: Number, default: 0 },
    cashAdvances: { type: Number, default: 0 },
    fuelShortagePenalty: { type: Number, default: 0 },
    fuelShortageLiters: { type: Number, default: 0 },
    netPayable: { type: Number, required: true },
    trips: [{ type: Schema.Types.ObjectId, ref: 'Trip' }],
    daysPresent: { type: Number, default: 0 },
    status: { type: String, enum: ['DRAFT', 'APPROVED', 'PAID'], default: 'DRAFT', index: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    paidAt: Date,
  },
  { timestamps: true },
);
PayslipSchema.index({ employee: 1, month: 1 }, { unique: true });
export type PayslipT = InferSchemaType<typeof PayslipSchema>;
export const Payslip = model('Payslip', PayslipSchema);
