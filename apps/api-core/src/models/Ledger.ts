import { Schema, model, type InferSchemaType } from 'mongoose';

export const ACCOUNTS = [
  // Assets
  'BANK',
  'CASH',
  'ACCOUNTS_RECEIVABLE',
  'DRIVER_ADVANCE',
  'GST_INPUT',
  // Liabilities
  'PUMP_PAYABLE',
  'WORKSHOP_PAYABLE',
  'BROKER_PAYABLE',
  'TDS_PAYABLE',
  'GST_OUTPUT',
  'SALARY_PAYABLE',
  'LOAN_PAYABLE',
  // Equity
  'OWNER_EQUITY',
  // Revenue
  'FREIGHT_REVENUE',
  'DETENTION_REVENUE',
  // Expenses
  'DIESEL_EXPENSE',
  'TOLL_EXPENSE',
  'DRIVER_BHATTA_EXPENSE',
  'RTO_EXPENSE',
  'LOADING_EXPENSE',
  'LORRY_HIRE_EXPENSE',
  'MAINTENANCE_EXPENSE',
  'TYRE_EXPENSE',
  'SALARY_EXPENSE',
  'EMI_INTEREST_EXPENSE',
  'INSURANCE_EXPENSE',
] as const;
export type Account = (typeof ACCOUNTS)[number];

export const ACCOUNT_CLASS: Record<Account, 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'> = {
  BANK: 'ASSET', CASH: 'ASSET', ACCOUNTS_RECEIVABLE: 'ASSET', DRIVER_ADVANCE: 'ASSET', GST_INPUT: 'ASSET',
  PUMP_PAYABLE: 'LIABILITY', WORKSHOP_PAYABLE: 'LIABILITY', BROKER_PAYABLE: 'LIABILITY', TDS_PAYABLE: 'LIABILITY',
  GST_OUTPUT: 'LIABILITY', SALARY_PAYABLE: 'LIABILITY', LOAN_PAYABLE: 'LIABILITY',
  OWNER_EQUITY: 'EQUITY',
  FREIGHT_REVENUE: 'REVENUE', DETENTION_REVENUE: 'REVENUE',
  DIESEL_EXPENSE: 'EXPENSE', TOLL_EXPENSE: 'EXPENSE', DRIVER_BHATTA_EXPENSE: 'EXPENSE', RTO_EXPENSE: 'EXPENSE',
  LOADING_EXPENSE: 'EXPENSE', LORRY_HIRE_EXPENSE: 'EXPENSE', MAINTENANCE_EXPENSE: 'EXPENSE', TYRE_EXPENSE: 'EXPENSE',
  SALARY_EXPENSE: 'EXPENSE', EMI_INTEREST_EXPENSE: 'EXPENSE', INSURANCE_EXPENSE: 'EXPENSE',
};

/** Accounts hidden from MANAGER (owner withdrawals, bank master balances). */
export const RESTRICTED_FOR_MANAGER: Account[] = ['OWNER_EQUITY', 'BANK', 'LOAN_PAYABLE'];

const LedgerEntrySchema = new Schema(
  {
    journalNo: { type: String, required: true, index: true },
    date: { type: Date, required: true, index: true },
    account: { type: String, enum: ACCOUNTS, required: true, index: true },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    narration: { type: String, required: true },
    refType: { type: String, enum: ['TRIP', 'PAYMENT', 'FUEL_SLIP', 'ADVANCE', 'MAINTENANCE', 'LORRY_HIRE', 'PAYROLL', 'EMI', 'INSURANCE', 'DRAWINGS', 'CAPITAL', 'REVERSAL', 'TYRE'] },
    refId: { type: Schema.Types.ObjectId },
    party: { kind: { type: String, enum: ['CLIENT', 'VENDOR', 'EMPLOYEE', 'OWNER', 'LENDER'] }, id: Schema.Types.ObjectId, name: String },
    truck: { type: Schema.Types.ObjectId, ref: 'Truck' },
    postedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reversalOf: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// ---- Immutability guards: ledger rows can only be inserted, never edited or deleted. ----
const immutable = function (next: (err?: Error) => void) {
  next(new Error('LedgerEntry is immutable — post a reversal journal instead'));
};
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace', 'replaceOne', 'deleteOne', 'deleteMany'] as const) {
  LedgerEntrySchema.pre(op, immutable as never);
}
LedgerEntrySchema.pre('save', function (next) {
  if (!this.isNew) return next(new Error('LedgerEntry is immutable — post a reversal journal instead'));
  if ((this.debit > 0) === (this.credit > 0)) return next(new Error('A ledger line must have exactly one of debit or credit'));
  next();
});

LedgerEntrySchema.index({ account: 1, date: -1 });
LedgerEntrySchema.index({ 'party.id': 1, account: 1 });

export type LedgerEntryT = InferSchemaType<typeof LedgerEntrySchema>;
export const LedgerEntry = model('LedgerEntry', LedgerEntrySchema);

/** Sequence counters (journal numbers, LR numbers…) – incremented atomically inside transactions. */
const CounterSchema = new Schema({ _id: { type: String, required: true }, seq: { type: Number, default: 0 } });
export const Counter = model('Counter', CounterSchema);
