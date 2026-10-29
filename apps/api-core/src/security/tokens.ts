import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { redis } from '../config/redis.js';
import { randomId } from './cryptoGuard.js';
import type { Role } from '../models/User.js';

export interface AccessClaims extends JwtPayload {
  sub: string;
  role: Role;
  name: string;
  tv: number; // tokenVersion – bumping it revokes all sessions
  jti: string;
  imp?: string; // impersonator (DEV) user id
}
export interface RefreshClaims extends JwtPayload {
  sub: string;
  tv: number;
  jti: string;
  fam: string; // rotation family
  imp?: string;
}

const BL_PREFIX = 'bl:';
const RT_PREFIX = 'rt:'; // active refresh token jti → userId (rotation reuse detection)

export function signAccessToken(c: Omit<AccessClaims, 'jti'>, ttl: string = env.ACCESS_TOKEN_TTL): string {
  return jwt.sign({ ...c, jti: randomId() }, env.JWT_ACCESS_SECRET, { expiresIn: ttl as jwt.SignOptions['expiresIn'], issuer: 'tms-api' });
}

export async function signRefreshToken(c: { sub: string; tv: number; fam?: string; imp?: string }, ttlDays = env.REFRESH_TOKEN_TTL_DAYS) {
  const jti = randomId();
  const fam = c.fam ?? randomId(8);
  const token = jwt.sign({ ...c, jti, fam }, env.JWT_REFRESH_SECRET, { expiresIn: `${ttlDays}d`, issuer: 'tms-api' });
  try {
    await redis.set(`${RT_PREFIX}${jti}`, c.sub, 'EX', ttlDays * 86400);
  } catch {
    // Redis offline fallback
  }
  return { token, jti, fam, maxAgeMs: ttlDays * 86400 * 1000 };
}

export function verifyAccess(token: string): AccessClaims {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'tms-api' }) as AccessClaims;
}
export function verifyRefresh(token: string): RefreshClaims {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, { issuer: 'tms-api' }) as RefreshClaims;
}

/** Blacklist a token jti in Redis for exactly its remaining lifetime. */
export async function blacklist(jti: string, exp: number | undefined, reason = 'logout'): Promise<void> {
  try {
    const ttl = Math.max(1, (exp ?? Math.floor(Date.now() / 1000) + 900) - Math.floor(Date.now() / 1000));
    await redis.set(`${BL_PREFIX}${jti}`, reason, 'EX', ttl);
  } catch {
    // Redis offline fallback
  }
}
export async function isBlacklisted(jti: string): Promise<boolean> {
  try {
    return (await redis.exists(`${BL_PREFIX}${jti}`)) === 1;
  } catch {
    return false;
  }
}
/** Consume a refresh token: returns false if it was already used (reuse ⇒ theft). */
export async function consumeRefresh(jti: string): Promise<boolean> {
  try {
    const deleted = await redis.del(`${RT_PREFIX}${jti}`);
    return deleted === 1;
  } catch {
    return true;
  }
}

/** DEV gate token – a second factor required on every /sys-internal request. */
export function signDevGate(userId: string): string {
  return jwt.sign({ sub: userId, scope: 'sys-internal', jti: randomId(8) }, env.DEV_GATE_SECRET, { expiresIn: '8h', issuer: 'tms-dev-gate' });
}
export function verifyDevGate(token: string): JwtPayload {
  return jwt.verify(token, env.DEV_GATE_SECRET, { issuer: 'tms-dev-gate' }) as JwtPayload;
}

export const REFRESH_COOKIE = 'tms_rt';
