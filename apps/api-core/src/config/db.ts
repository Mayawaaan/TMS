import mongoose from 'mongoose';
import dns from 'node:dns';
import { env } from './env.js';

mongoose.set('strictQuery', true);

// Configure public DNS servers as fallback if Windows local DNS resolver refuses SRV queries
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', ...dns.getServers()]);
} catch {
  // ignore
}

let connectPromise: Promise<typeof mongoose> | null = null;

export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }
  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = (async () => {
    const localUri = 'mongodb://127.0.0.1:27017/tms_erp?replicaSet=rs0&directConnection=true';

    // In development, check if local rs0 on 127.0.0.1:27017 is already running first for instant (<50ms) boot
    if (env.NODE_ENV !== 'production') {
      try {
        const conn = await mongoose.connect(localUri, {
          serverSelectionTimeoutMS: 1200,
          retryWrites: true,
        });
        console.log('[db] Connected to local rs0 (PRIMARY)');
        return conn;
      } catch {
        // Local rs0 not listening yet; try configured MONGO_URI next
      }
    }

    try {
      const conn = await mongoose.connect(env.MONGO_URI, {
        serverSelectionTimeoutMS: 4000,
        retryWrites: true,
      });
      const admin = conn.connection.db!.admin();
      const hello = await admin.command({ hello: 1 });
      if (!hello.setName) {
        throw new Error('MongoDB is not running as a replica set — ACID ledger transactions require rs0.');
      }
      try {
        await conn.connection.db!.command({ profile: 1, slowms: 40 });
      } catch {
        /* profiler not permitted on some managed clusters */
      }
      console.log(`[db] Connected to ${hello.setName} (${hello.isWritablePrimary ? 'PRIMARY' : 'SECONDARY'})`);
      return conn;
    } catch (err) {
      console.warn(`[db] Primary MONGO_URI unreachable (${(err as Error).message}). Attempting local rs0 replica set fallback...`);
      try {
        const conn = await mongoose.connect(localUri, {
          serverSelectionTimeoutMS: 2000,
          retryWrites: true,
        });
        console.log('[db] Connected to local rs0 (PRIMARY)');
        return conn;
      } catch {
        // If local port 27017 isn't running yet, auto-boot embedded MongoMemoryReplSet
        const { MongoMemoryReplSet } = await import('mongodb-memory-server');
        const path = await import('node:path');
        const fs = await import('node:fs');
        const { fileURLToPath } = await import('node:url');
        const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
        const mongoPath = path.join(root, '.data', 'mongo');
        fs.mkdirSync(mongoPath, { recursive: true });
        console.log('[db] Starting embedded MongoDB rs0 replica set at', mongoPath);
        try {
          const replSet = await MongoMemoryReplSet.create({
            binary: { version: '7.0.14' },
            replSet: { name: 'rs0', count: 1, storageEngine: 'wiredTiger' },
            instanceOpts: [{ port: 27017, dbPath: mongoPath, storageEngine: 'wiredTiger' }],
          });
          await replSet.waitUntilRunning();
          (globalThis as unknown as Record<string, unknown>).__tmsEmbeddedReplSet = replSet;
          const cleanup = async () => {
            try {
              await mongoose.disconnect();
              await replSet.stop({ doCleanup: false });
            } catch {
              // ignore
            }
            process.exit(0);
          };
          process.once('SIGINT', cleanup);
          process.once('SIGTERM', cleanup);
        } catch {
          // Another instance is already booting or holding the dbPath; wait briefly and connect to it
          await new Promise((r) => setTimeout(r, 2000));
        }
        const conn = await mongoose.connect(localUri, {
          serverSelectionTimeoutMS: 10000,
          retryWrites: true,
        });
        console.log('[db] Connected to embedded rs0 (PRIMARY)');
        return conn;
      }
    }
  })().finally(() => {
    connectPromise = null;
  });

  return connectPromise;
}

/** Run `fn` inside a multi-document ACID transaction with automatic retry on transient errors. */
export async function withTransaction<T>(fn: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(
      async () => {
        result = await fn(session);
      },
      { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' },
    );
    return result;
  } finally {
    await session.endSession();
  }
}
