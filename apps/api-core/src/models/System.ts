import { Schema, model, type InferSchemaType } from 'mongoose';

const AuditLogSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    actorName: String,
    actorRole: String,
    impersonatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true, index: true },
    entity: { type: String },
    entityId: { type: String },
    meta: { type: Schema.Types.Mixed },
    ip: String,
    userAgent: String,
    status: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
AuditLogSchema.index({ createdAt: -1 });
export const AuditLog = model('AuditLog', AuditLogSchema);

const FeatureFlagSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    description: String,
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
export type FeatureFlagT = InferSchemaType<typeof FeatureFlagSchema>;
export const FeatureFlag = model('FeatureFlag', FeatureFlagSchema);

const SettingSchema = new Schema({ key: { type: String, required: true, unique: true }, value: Schema.Types.Mixed }, { timestamps: true });
export const Setting = model('Setting', SettingSchema);

const AiAlertSchema = new Schema(
  {
    type: { type: String, enum: ['FUEL_THEFT', 'MAINTENANCE_RISK', 'CREDIT_RISK', 'COMPLIANCE', 'CASHFLOW'], required: true, index: true },
    severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], required: true },
    title: { type: String, required: true },
    detail: String,
    truck: { type: Schema.Types.ObjectId, ref: 'Truck' },
    trip: { type: Schema.Types.ObjectId, ref: 'Trip' },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee' },
    metrics: Schema.Types.Mixed,
    status: { type: String, enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'], default: 'OPEN', index: true },
    dedupeKey: { type: String, unique: true, sparse: true },
    modelVersion: String,
  },
  { timestamps: true },
);
export type AiAlertT = InferSchemaType<typeof AiAlertSchema>;
export const AiAlert = model('AiAlert', AiAlertSchema);
