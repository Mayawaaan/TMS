import { Schema, model, type InferSchemaType } from 'mongoose';

const RateContractSchema = new Schema(
  {
    origin: { type: String, required: true },
    destination: { type: String, required: true },
    ratePerTon: { type: Number, required: true, min: 0 },
    minGuaranteeTons: { type: Number, default: 0 },
    validFrom: { type: Date, default: Date.now },
    validTill: { type: Date, required: true },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'APPROVED' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

const ClientSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    industry: { type: String },
    gstin: { type: String, required: true, match: /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/ },
    pan: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    contactPerson: { type: String },
    phone: { type: String },
    email: { type: String },
    creditLimit: { type: Number, required: true, min: 0 },
    currentOutstanding: { type: Number, default: 0 },
    paymentTermsDays: { type: Number, enum: [15, 30, 45, 60, 90], default: 30 },
    /** GTA tax mode: RCM 5% (recipient pays) or Forward Charge 12% (GTA charges). */
    gstMode: { type: String, enum: ['RCM_5', 'FCM_12'], default: 'RCM_5' },
    rateContracts: [RateContractSchema],
    creditOverrides: [
      {
        by: { type: Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
        previousLimit: Number,
        newLimit: Number,
        reason: String,
        _id: false,
      },
    ],
    blocked: { type: Boolean, default: false },
  },
  { timestamps: true },
);

ClientSchema.virtual('creditUtilisation').get(function () {
  return this.creditLimit > 0 ? this.currentOutstanding / this.creditLimit : 0;
});
ClientSchema.set('toJSON', { virtuals: true });

export type ClientT = InferSchemaType<typeof ClientSchema>;
export const Client = model('Client', ClientSchema);
