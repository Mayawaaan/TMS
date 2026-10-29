import { Queue, Worker, type Job } from 'bullmq';
import { bullConnection, redis } from '../config/redis.js';
import { ai, runFuelAudit, runPredictiveMaintenance } from '../services/ai.client.js';
import { complianceWatchdog } from '../services/analytics.service.js';
import { AiAlert } from '../models/index.js';
import { isEnabled } from '../services/flags.service.js';

export const QUEUE_NAMES = ['ai-jobs', 'compliance-watchdog'] as const;

interface SafeQueue {
  add: (name: string, data: unknown, opts?: Record<string, unknown>) => Promise<unknown>;
  upsertJobScheduler?: (id: string, repeat: Record<string, unknown>, template: { name: string }) => Promise<unknown>;
  getWaitingCount: () => Promise<number>;
  getActiveCount: () => Promise<number>;
  getCompletedCount: () => Promise<number>;
  getFailedCount: () => Promise<number>;
  getDelayedCount: () => Promise<number>;
}

function createNoopQueue(): SafeQueue {
  return {
    add: async () => null,
    getWaitingCount: async () => 0,
    getActiveCount: async () => 0,
    getCompletedCount: async () => 0,
    getFailedCount: async () => 0,
    getDelayedCount: async () => 0,
  };
}

export let aiQueue: SafeQueue = createNoopQueue();
export let complianceQueue: SafeQueue = createNoopQueue();
export const queues: Record<string, SafeQueue> = {
  'ai-jobs': aiQueue,
  'compliance-watchdog': complianceQueue,
};

async function aiProcessor(job: Job) {
  switch (job.name) {
    case 'fuel-audit': {
      if (job.data?.auto && !(await isEnabled('ai.autoFuelAudit'))) return { skipped: 'flag disabled' };
      const r = await runFuelAudit(job.data?.tripIds);
      return { audited: r.results.length, flagged: r.results.filter((x) => x.isFlaggedForTheft).length, model: r.model_version };
    }
    case 'predictive-maintenance': {
      if (!(await isEnabled('ai.predictiveMaintenance'))) return { skipped: 'flag disabled' };
      const r = await runPredictiveMaintenance(job.data?.truckIds);
      return { trucks: r.trucks.length, model: r.model_version };
    }
    case 'retrain-models': {
      const { data } = await ai.post('/ai/retrain', {});
      return data;
    }
    default:
      throw new Error(`Unknown AI job ${job.name}`);
  }
}

async function complianceProcessor() {
  const items = await complianceWatchdog();
  let raised = 0;
  for (const i of items.filter((x) => x.level !== 'OK')) {
    await AiAlert.updateOne(
      { dedupeKey: `COMP:${i.truckId}:${i.doc}:${new Date(i.expiry).toISOString().slice(0, 10)}` },
      {
        $set: {
          type: 'COMPLIANCE',
          severity: i.level === 'EXPIRED' || i.level === 'CRITICAL' ? 'CRITICAL' : i.level === 'WARNING' ? 'HIGH' : 'MEDIUM',
          title: `${i.label} ${i.daysLeft < 0 ? 'EXPIRED' : `expires in ${i.daysLeft}d`} — ${i.regNumber}`,
          detail: `Expiry ${new Date(i.expiry).toDateString()}`,
          truck: i.truckId,
          metrics: i,
        },
        $setOnInsert: { status: 'OPEN' },
      },
      { upsert: true },
    );
    raised++;
  }
  return { scanned: items.length, raised };
}

export async function startWorkers() {
  try {
    await redis.connect();
    await redis.ping();

    const conn = bullConnection();
    const realAiQueue = new Queue('ai-jobs', {
      connection: conn,
      defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 200, removeOnFail: 500 },
    });
    const realComplianceQueue = new Queue('compliance-watchdog', {
      connection: conn,
      defaultJobOptions: { removeOnComplete: 50, removeOnFail: 100 },
    });
    realAiQueue.on('error', () => undefined);
    realComplianceQueue.on('error', () => undefined);

    aiQueue = realAiQueue as unknown as SafeQueue;
    complianceQueue = realComplianceQueue as unknown as SafeQueue;
    queues['ai-jobs'] = aiQueue;
    queues['compliance-watchdog'] = complianceQueue;

    const w1 = new Worker('ai-jobs', aiProcessor, { connection: bullConnection(), concurrency: 1 });
    const w2 = new Worker('compliance-watchdog', complianceProcessor, { connection: bullConnection(), concurrency: 1 });
    for (const w of [w1, w2]) {
      w.on('error', () => undefined);
      w.on('failed', (job, err) => console.warn(`[queue] ${w.name}:${job?.name} failed — ${err.message}`));
      w.on('completed', (job, rv) => console.log(`[queue] ${w.name}:${job.name} ✓ ${JSON.stringify(rv)}`));
    }
    // Repeatable schedules (idempotent by key).
    await realComplianceQueue.upsertJobScheduler('daily-compliance', { pattern: '0 6 * * *' }, { name: 'scan' });
    await realAiQueue.upsertJobScheduler('nightly-pm', { pattern: '30 2 * * *' }, { name: 'predictive-maintenance' });
    await realComplianceQueue.add('scan', {}, { jobId: `boot-scan-${new Date().toISOString().slice(0, 13)}` });
    return [w1, w2];
  } catch (err) {
    console.warn(`[queue] Redis unavailable (${(err as Error).message}) — background queues running in in-memory fallback mode.`);
    return [];
  }
}
