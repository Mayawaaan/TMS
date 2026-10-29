import type { ClientSession, Types } from 'mongoose';
import { Counter, LedgerEntry, type Account } from '../models/Ledger.js';

export interface JournalLine {
  account: Account;
  debit?: number;
  credit?: number;
}
export interface JournalMeta {
  date: Date;
  narration: string;
  refType: string;
  refId?: Types.ObjectId | string;
  party?: { kind: 'CLIENT' | 'VENDOR' | 'EMPLOYEE' | 'OWNER' | 'LENDER'; id?: Types.ObjectId | string; name?: string };
  truck?: Types.ObjectId | string;
  postedBy?: Types.ObjectId | string;
  reversalOf?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function nextSequence(key: string, session?: ClientSession): Promise<number> {
  const c = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, new: true, session });
  return c!.seq;
}

/**
 * Posts a balanced double-entry journal. MUST be called with an active transaction session so that
 * the ledger rows commit atomically with the business mutation they describe.
 */
export async function postJournal(lines: JournalLine[], meta: JournalMeta, session: ClientSession): Promise<string> {
  if (!session?.inTransaction()) throw new Error('postJournal requires an active MongoDB transaction');
  const clean = lines
    .map((l) => ({ ...l, debit: round2(l.debit ?? 0), credit: round2(l.credit ?? 0) }))
    .filter((l) => l.debit > 0 || l.credit > 0);
  const dr = round2(clean.reduce((s, l) => s + l.debit, 0));
  const cr = round2(clean.reduce((s, l) => s + l.credit, 0));
  if (clean.length < 2 || Math.abs(dr - cr) > 0.01) {
    throw new Error(`Unbalanced journal: Dr ${dr} ≠ Cr ${cr} (${meta.narration})`);
  }
  const year = meta.date.getFullYear();
  const seq = await nextSequence(`JV-${year}`, session);
  const journalNo = `JV/${year}/${String(seq).padStart(6, '0')}`;
  await LedgerEntry.insertMany(
    clean.map((l) => ({ ...meta, journalNo, account: l.account, debit: l.debit, credit: l.credit })),
    { session },
  );
  return journalNo;
}

/** Reverses a journal by posting mirror lines (ledger rows are never edited). */
export async function reverseJournal(journalNo: string, postedBy: string, reason: string, session: ClientSession) {
  const rows = await LedgerEntry.find({ journalNo }).session(session).lean();
  if (!rows.length) throw new Error(`Journal ${journalNo} not found`);
  if (await LedgerEntry.exists({ reversalOf: journalNo }).session(session)) throw new Error('Journal already reversed');
  return postJournal(
    rows.map((r) => ({ account: r.account as Account, debit: r.credit, credit: r.debit })),
    {
      date: new Date(),
      narration: `REVERSAL of ${journalNo}: ${reason}`,
      refType: 'REVERSAL',
      refId: r0(rows).refId ?? undefined,
      party: r0(rows).party as JournalMeta['party'],
      postedBy,
      reversalOf: journalNo,
    },
    session,
  );
}
const r0 = <T>(a: T[]) => a[0];

/** GTA GST: RCM 5% → recipient pays (not on our invoice), FCM 12% → charged on invoice. */
export function computeGst(taxable: number, mode: 'RCM_5' | 'FCM_12') {
  const rate = mode === 'FCM_12' ? 0.12 : 0.05;
  const gstAmount = mode === 'FCM_12' ? round2(taxable * rate) : 0;
  return { gstRate: rate, gstAmount, total: round2(taxable + gstAmount), rcmLiabilityOfRecipient: mode === 'RCM_5' ? round2(taxable * rate) : 0 };
}
