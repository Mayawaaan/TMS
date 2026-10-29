import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Automatically load .env from apps/api-core/.env or workspace root .env if not already loaded
const __dirname = path.dirname(fileURLToPath(import.meta.url));
for (const candidate of [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../../.env'),
]) {
  if (fs.existsSync(candidate) && typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile(candidate);
    } catch {
      // ignore
    }
  }
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  MONGO_URI: z.string().min(1),
  REDIS_URL: z.string().min(1),
  AI_ENGINE_URL: z.string().default('http://127.0.0.1:8000'),
  GLOBAL_SECRET_PEPPER: z.string().min(16, 'GLOBAL_SECRET_PEPPER must be at least 16 chars'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  DEV_GATE_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  ALLOW_LOCAL_QUICK_SWITCH: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  SEED_DEFAULT_PASSWORD: z.string().default('Fleet@2026'),
  SEED_FINANCIAL_PIN: z.string().regex(/^\d{6}$/).default('482916'),
  SEED_DEV_EMAIL: z.string().email().default('architect@sys.internal'),
  SEED_DEV_PASSWORD: z.string().default('Obsidian#Dev2026'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
