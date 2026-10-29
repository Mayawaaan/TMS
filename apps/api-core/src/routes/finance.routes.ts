import { Router } from 'express';
import { z } from 'zod';
import { LedgerEntry, RESTRICTED_FOR_MANAGER, type Account } from '../models/index.js';
import { authenticate, requireRole, asyncH, HttpError, validate, requireFinancialPin } from '../middleware/index.js';
import {
  accountBalances,
  trialBalance,
  profitAndLoss,
  cashflowWaterfall,
  receivablesAging,
  defaultPeriod,
} from '../services/analytics.service.js';
import { postOwnerEquity } from '../services/ops.service.js';
import { reverseJournal } from '../services/ledger.service.js';
import { withTransaction } from '../config/db.js';
import type { Actor } from '../services/trip.service.js';

export const financeRouter = Router();

// LEDGER ENTRIES with Manager Restrictions
financeRouter.get(
  '/ledger',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'DEV'),
  asyncH(async (req, res) => {
    const { account, from, to, partyId, truckId, limit = '100' } = req.query;

    const query: Record<string, unknown> = {};
    if (from || to) {
      query.date = {};
      if (from) (query.date as Record<string, unknown>).$gte = new Date(String(from));
      if (to) (query.date as Record<string, unknown>).$lte = new Date(String(to));
    }
    if (partyId) query['party.id'] = partyId;
    if (truckId) query.truck = truckId;

    // Strict Manager Restriction: Cannot view Owner Equity, Bank, or Loan Payable accounts
    if (req.auth!.role === 'MANAGER') {
      if (account && RESTRICTED_FOR_MANAGER.includes(account as Account)) {
        return res.json([]);
      }
      query.account = { $nin: RESTRICTED_FOR_MANAGER };
    } else if (account) {
      query.account = account;
    }

    const entries = await LedgerEntry.find(query)
      .sort({ date: -1, createdAt: -1 })
      .limit(Number(limit))
      .lean();

    res.json(entries);
  }),
);

// TRIAL BALANCE
financeRouter.get(
  '/trial-balance',
  authenticate,
  requireRole('ADMIN', 'DEV'),
  asyncH(async (_req, res) => {
    const tb = await trialBalance();
    res.json(tb);
  }),
);

// P&L and EBITDA
financeRouter.get(
  '/pnl',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'DEV'),
  asyncH(async (req, res) => {
    const { days = '120' } = req.query;
    const period = defaultPeriod(Number(days));
    const pl = await profitAndLoss(period);

    // If MANAGER, EBITDA is visible but owner withdrawals / bank equity balances are omitted
    res.json({
      period,
      ...pl,
    });
  }),
);

// CASHFLOW WATERFALL CHART DATA
financeRouter.get(
  '/cashflow-waterfall',
  authenticate,
  requireRole('ADMIN', 'DEV'),
  asyncH(async (req, res) => {
    const { days = '120' } = req.query;
    const period = defaultPeriod(Number(days));
    const waterfall = await cashflowWaterfall(period);
    res.json(waterfall);
  }),
);

// RECEIVABLES AGING BUCKETS (0-30, 31-60, 61-90, 90+ days)
financeRouter.get(
  '/receivables-aging',
  authenticate,
  requireRole('ADMIN', 'MANAGER', 'DEV'),
  asyncH(async (_req, res) => {
    const aging = await receivablesAging();
    res.json(aging);
  }),
);

// OWNER CAPITAL & WITHDRAWALS (ADMIN only + 6-digit Financial PIN)
const OwnerEquitySchema = z.object({
  kind: z.enum(['CAPITAL', 'DRAWINGS']),
  amount: z.number().min(1),
  narration: z.string().min(3),
  financialPin: z.string().regex(/^\d{6}$/),
});

financeRouter.post(
  '/owner-equity',
  authenticate,
  requireRole('ADMIN', 'DEV'),
  requireFinancialPin,
  validate(OwnerEquitySchema),
  asyncH(async (req, res) => {
    const actor: Actor = { id: req.auth!.sub, role: req.auth!.role };
    const jv = await postOwnerEquity(req.body.kind, req.body.amount, req.body.narration, actor);
    res.json({ ok: true, journalNo: jv });
  }),
);

// REVERSE JOURNAL (ADMIN only)
financeRouter.post(
  '/reverse-journal',
  authenticate,
  requireRole('ADMIN', 'DEV'),
  requireFinancialPin,
  validate(
    z.object({
      journalNo: z.string(),
      reason: z.string().min(3),
      financialPin: z.string().regex(/^\d{6}$/),
    }),
  ),
  asyncH(async (req, res) => {
    const jv = await withTransaction(async (session) => {
      return reverseJournal(req.body.journalNo, req.auth!.sub, req.body.reason, session);
    });
    res.json({ ok: true, reversalJournalNo: jv });
  }),
);
