/**
 * Local infrastructure launcher (no Docker / no system installs required).
 *  - MongoDB: real `mongod` binary managed by mongodb-memory-server, started as a
 *    single-node REPLICA SET "rs0" (required for multi-document ACID transactions),
 *    persisted to ./.data/mongo so data survives restarts.
 *  - Redis:   portable Redis for Windows from ./.tools/redis (run `npm run setup:redis`).
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mongoPath = path.join(root, '.data', 'mongo');
const redisDir = path.join(root, '.tools', 'redis');
const redisData = path.join(root, '.data', 'redis');
mkdirSync(mongoPath, { recursive: true });
mkdirSync(redisData, { recursive: true });

const redisExe = path.join(redisDir, process.platform === 'win32' ? 'redis-server.exe' : 'redis-server');
if (!existsSync(redisExe)) {
  console.error(`[infra] Redis binary missing at ${redisExe}. Run: npm run setup:redis`);
  process.exit(1);
}

const redis = spawn(redisExe, ['--port', '6379', '--dir', redisData, '--appendonly', 'yes', '--save', '60 100', '--protected-mode', 'no'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
redis.stdout.on('data', (d) => {
  const s = d.toString();
  if (/Ready to accept connections/i.test(s)) console.log('[infra] Redis ready on redis://127.0.0.1:6379');
});
redis.stderr.on('data', (d) => process.stderr.write(`[redis] ${d}`));
redis.on('exit', (code) => console.log(`[infra] Redis exited (${code})`));

console.log('[infra] Starting MongoDB replica set rs0 (first run downloads the mongod binary)…');
const replSet = await MongoMemoryReplSet.create({
  binary: { version: '7.0.14' },
  replSet: { name: 'rs0', count: 1, storageEngine: 'wiredTiger' },
  instanceOpts: [{ port: 27017, dbPath: mongoPath, storageEngine: 'wiredTiger' }],
});
await replSet.waitUntilRunning();
console.log(`[infra] MongoDB rs0 PRIMARY ready → mongodb://127.0.0.1:27017/tms_erp?replicaSet=rs0&directConnection=true`);
console.log('[infra] Press Ctrl+C to stop.');

const shutdown = async () => {
  console.log('\n[infra] Shutting down…');
  redis.kill();
  await replSet.stop({ doCleanup: false, force: false });
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
