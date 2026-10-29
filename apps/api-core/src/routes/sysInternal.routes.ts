import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { authenticate, devGate, asyncH, validate } from '../middleware/index.js';
import { redis } from '../config/redis.js';
import { queues, aiQueue } from '../queues/index.js';
import { AuditLog, FeatureFlag } from '../models/index.js';
import { getFlags, setFlag, isEnabled, DEFAULT_FLAGS } from '../services/flags.service.js';
import { runFuelAudit, runPredictiveMaintenance } from '../services/ai.client.js';

export const sysInternalRouter = Router();

// Apply DEV gate cloaking to all routes under /sys-internal
sysInternalRouter.use(authenticate, devGate);

// 1. SYSTEM OVERVIEW & DB STATS
sysInternalRouter.get(
  '/overview',
  asyncH(async (_req, res) => {
    const db = mongoose.connection.db!;
    const admin = db.admin();

    const [serverStatus, replStatus] = await Promise.all([
      admin.serverStatus().catch(() => ({})),
      admin.command({ replSetGetStatus: 1 }).catch(() => ({})),
    ]);

    const collections = await db.listCollections().toArray();
    const stats: Record<string, number> = {};
    for (const col of collections) {
      stats[col.name] = await db.collection(col.name).countDocuments();
    }

    const redisMemory = await redis.info('memory').catch(() => 'used_memory_human:0B');
    const redisClients = await redis.info('clients').catch(() => 'connected_clients:0');

    res.json({
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        name: db.databaseName,
        replicaSet: (replStatus as { set?: string })?.set || 'rs0',
        connections: (serverStatus as { connections?: unknown })?.connections,
        documentCounts: stats,
      },
      redis: {
        memory: redisMemory.split('\r\n').filter((l) => l.startsWith('used_memory_human')),
        clients: redisClients.split('\r\n').filter((l) => l.startsWith('connected_clients')),
      },
    });
  }),
);

// 2. REDIS QUEUE & TOKEN BLACKLIST INSPECTOR
sysInternalRouter.get(
  '/redis-inspector',
  asyncH(async (_req, res) => {
    // Scan blacklisted tokens
    const blacklistKeys = await redis.keys('bl:*').catch(() => [] as string[]);
    const blacklistDetails = [];
    for (const k of blacklistKeys.slice(0, 50)) {
      const ttl = await redis.ttl(k).catch(() => 0);
      const val = await redis.get(k).catch(() => null);
      blacklistDetails.push({ key: k, reason: val, ttlSeconds: ttl });
    }

    // Active refresh token families
    const rtKeys = await redis.keys('rt:*').catch(() => [] as string[]);

    // BullMQ Queue counts
    const queueStats: Record<string, unknown> = {};
    for (const [name, q] of Object.entries(queues)) {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        q.getWaitingCount(),
        q.getActiveCount(),
        q.getCompletedCount(),
        q.getFailedCount(),
        q.getDelayedCount(),
      ]);
      queueStats[name] = { waiting, active, completed, failed, delayed };
    }

    res.json({
      blacklistedTokens: {
        total: blacklistKeys.length,
        samples: blacklistDetails,
      },
      activeRefreshTokensCount: rtKeys.length,
      queues: queueStats,
    });
  }),
);

// 3. MONGODB SLOW-QUERY PROFILER
sysInternalRouter.get(
  '/slow-queries',
  asyncH(async (req, res) => {
    const { minMillis = '30', limit = '50' } = req.query;
    const db = mongoose.connection.db!;

    try {
      const profileCollection = db.collection('system.profile');
      const queries = await profileCollection
        .find({ millis: { $gte: Number(minMillis) } })
        .sort({ ts: -1 })
        .limit(Number(limit))
        .toArray();

      res.json({
        profilerEnabled: true,
        count: queries.length,
        queries: queries.map((q) => ({
          op: q.op,
          ns: q.ns,
          command: q.command,
          millis: q.millis,
          docsExamined: q.docsExamined,
          keysExamined: q.keysExamined,
          ts: q.ts,
          client: q.client,
        })),
      });
    } catch {
      res.json({ profilerEnabled: false, message: 'system.profile collection not queryable' });
    }
  }),
);

// 4. SYSTEM AUDIT TRAIL
sysInternalRouter.get(
  '/audit-logs',
  asyncH(async (req, res) => {
    const { action, actorRole, limit = '100' } = req.query;
    const query: Record<string, unknown> = {};
    if (action) query.action = new RegExp(String(action), 'i');
    if (actorRole) query.actorRole = actorRole;

    const unmaskWithdrawals = await isEnabled('dev.unmaskOwnerWithdrawals');

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    // If owner withdrawals masking is active, sanitize meta/actions
    const sanitized = logs.map((log) => {
      if (!unmaskWithdrawals && log.action.includes('/owner-equity')) {
        return {
          ...log,
          meta: { masked: '*** FINANCIAL AMOUNT REDACTED (Toggle dev.unmaskOwnerWithdrawals to inspect) ***' },
        };
      }
      return log;
    });

    res.json(sanitized);
  }),
);

// 5. FEATURE FLAGS SWITCHBOARD
sysInternalRouter.get(
  '/feature-flags',
  asyncH(async (_req, res) => {
    // Ensure all default flags exist in DB
    for (const df of DEFAULT_FLAGS) {
      await FeatureFlag.updateOne({ key: df.key }, { $setOnInsert: df }, { upsert: true });
    }
    const flags = await FeatureFlag.find().sort({ key: 1 }).lean();
    res.json(flags);
  }),
);

sysInternalRouter.post(
  '/feature-flags/:key',
  validate(z.object({ enabled: z.boolean() })),
  asyncH(async (req, res) => {
    const doc = await setFlag(req.params.key, req.body.enabled, req.auth!.sub);
    res.json(doc);
  }),
);

// 6. TRIGGER AI RETRAINING / AUDITS FROM DEV PORTAL
sysInternalRouter.post(
  '/trigger-ai-audit',
  asyncH(async (_req, res) => {
    const result = await runFuelAudit();
    res.json(result);
  }),
);

sysInternalRouter.post(
  '/trigger-maintenance-scan',
  asyncH(async (_req, res) => {
    const result = await runPredictiveMaintenance();
    res.json(result);
  }),
);

sysInternalRouter.post(
  '/trigger-model-retrain',
  asyncH(async (_req, res) => {
    await aiQueue.add('retrain-models', {});
    res.json({ ok: true, message: 'AI model retraining job dispatched to BullMQ queue' });
  }),
);
