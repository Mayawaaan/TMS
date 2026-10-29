import { redis } from '../config/redis.js';
import { FeatureFlag } from '../models/index.js';

const KEY = 'flags:all';

export const DEFAULT_FLAGS = [
  { key: 'ai.autoFuelAudit', enabled: true, description: 'Queue an Isolation-Forest fuel audit automatically when a trip is unloaded' },
  { key: 'ai.predictiveMaintenance', enabled: true, description: 'Nightly Weibull failure-risk scan of all trucks' },
  { key: 'finance.strictCreditBlock', enabled: true, description: 'Block Bilty creation when client outstanding exceeds credit limit' },
  { key: 'ops.marketTruckHiring', enabled: true, description: 'Allow hiring third-party market trucks via brokers' },
  { key: 'dev.unmaskOwnerWithdrawals', enabled: false, description: 'DEBUG: reveal owner drawings amounts inside the DEV audit views' },
  { key: 'ui.commandPalette', enabled: true, description: 'Global ⌘K command palette' },
  { key: 'driver.podUpload', enabled: true, description: 'Allow drivers to upload POD / toll receipts from the PWA' },
];

export async function getFlags(): Promise<Record<string, boolean>> {
  try {
    const hit = await redis.get(KEY);
    if (hit) return JSON.parse(hit);
  } catch {
    // Redis offline fallback
  }
  const docs = await FeatureFlag.find().lean();
  const map = Object.fromEntries(docs.map((d) => [d.key, d.enabled]));
  try {
    await redis.set(KEY, JSON.stringify(map), 'EX', 300);
  } catch {
    // Redis offline fallback
  }
  return map;
}

export async function isEnabled(key: string): Promise<boolean> {
  const f = await getFlags();
  return f[key] ?? DEFAULT_FLAGS.find((d) => d.key === key)?.enabled ?? false;
}

export async function setFlag(key: string, enabled: boolean, by: string) {
  const doc = await FeatureFlag.findOneAndUpdate({ key }, { enabled, updatedBy: by }, { new: true });
  try {
    await redis.del(KEY);
  } catch {
    // Redis offline fallback
  }
  return doc;
}
