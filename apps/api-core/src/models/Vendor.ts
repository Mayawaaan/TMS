import { Schema, model, type InferSchemaType } from 'mongoose';

export const VENDOR_TYPES = ['BROKER', 'PETROL_PUMP', 'WORKSHOP', 'TYRE_DEALER', 'SPARE_PARTS'] as const;

/** Brokers / market-truck owners, highway pumps, workshops, spare-part vendors. */
const VendorSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    type: { type: String, enum: VENDOR_TYPES, required: true, index: true },
    name: { type: String, required: true, trim: true },
    pan: { type: String, match: /^[A-Z]{5}\d{4}[A-Z]$/ },
    gstin: { type: String },
    city: { type: String },
    highway: { type: String }, // e.g. NH-52 for pumps
    contactPerson: String,
    phone: String,
    /** Section 194C: 1% individual/HUF, 2% others; exempt if declared ≤10 trucks with valid PAN. */
    tdsSection: { type: String, default: '194C' },
    tdsRate: { type: Number, default: 0.01 },
    tdsExemptDeclaration: { type: Boolean, default: false },
    creditLimit: { type: Number, default: 0 },
    currentOutstanding: { type: Number, default: 0 },
    creditDays: { type: Number, default: 15 },
    fuelRatePerLiter: { type: Number }, // contracted pump rate
    rating: { type: Number, min: 1, max: 5, default: 4 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type VendorT = InferSchemaType<typeof VendorSchema>;
export const Vendor = model('Vendor', VendorSchema);
