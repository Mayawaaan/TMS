import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const ROLES = ['DEV', 'ADMIN', 'MANAGER', 'STAFF', 'DRIVER'] as const;
export type Role = (typeof ROLES)[number];
/** Roles that may be created via authenticated API — DEV is CLI-seed only. */
export const PUBLIC_ROLES = ['ADMIN', 'MANAGER', 'STAFF', 'DRIVER'] as const;

const SecretSchema = new Schema({ hash: { type: String, required: true }, salt: { type: String, required: true } }, { _id: false });

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    role: { type: String, enum: ROLES, required: true, index: true },
    password: { type: SecretSchema, required: true, select: false },
    financialPin: { type: SecretSchema, select: false },
    isHiddenDev: { type: Boolean, default: false, select: false },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee' },
    active: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    failedLogins: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    lastLoginAt: { type: Date },
    avatarHue: { type: Number, default: () => Math.floor(Math.random() * 360) },
  },
  { timestamps: true },
);

UserSchema.pre('validate', function (next) {
  // Defence in depth: a DEV role document MUST carry the hidden flag (only the CLI seeder sets it).
  if (this.role === 'DEV' && !this.isHiddenDev) return next(new Error('DEV accounts can only be provisioned via CLI seeder'));
  if (this.isHiddenDev && this.role !== 'DEV') return next(new Error('isHiddenDev is reserved for DEV role'));
  next();
});

export type UserT = InferSchemaType<typeof UserSchema>;
export type UserDoc = HydratedDocument<UserT>;
export const User = model('User', UserSchema);
