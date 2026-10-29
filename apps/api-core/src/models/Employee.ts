import { Schema, model, type InferSchemaType } from 'mongoose';

/** Drivers, cleaners (khalasi), loading labour, operations staff and managers on payroll. */
const EmployeeSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, required: true },
    designation: { type: String, enum: ['DRIVER', 'CLEANER', 'LABOUR', 'MECHANIC', 'STAFF', 'MANAGER', 'ADMIN'], default: 'DRIVER' },
    licenseNo: { type: String },
    licenseExpiry: { type: Date },
    homeTown: { type: String },
    bloodGroup: { type: String },
    emergencyContact: { type: String },
    aadhaarLast4: { type: String },
    bankAccountLast4: { type: String },
    baseSalary: { type: Number, required: true, min: 0 },
    kmIncentive: { type: Number, default: 0.5, min: 0 }, // ₹ per KM driven
    bhattaPerDay: { type: Number, default: 350, min: 0 },
    assignedTruck: { type: Schema.Types.ObjectId, ref: 'Truck' },
    joinedAt: { type: Date, default: Date.now },
    active: { type: Boolean, default: true },
    hiredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    hiredByName: { type: String },
    terminationReason: { type: String },
    terminatedAt: { type: Date },
    terminatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export type EmployeeT = InferSchemaType<typeof EmployeeSchema>;
export const Employee = model('Employee', EmployeeSchema);
