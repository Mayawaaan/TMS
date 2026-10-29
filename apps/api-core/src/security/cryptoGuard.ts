/**
 * cryptoGuard — Peppered + salted secret hashing.
 *
 *   prehash = HMAC-SHA256( GLOBAL_SECRET_PEPPER , userSalt ‖ ":" ‖ secret )   (base64, 44 chars < bcrypt's 72-byte limit)
 *   stored  = bcrypt( prehash , cost=12 )
 *
 * - The pepper lives only in server env, so a leaked DB alone cannot be brute-forced offline.
 * - The per-user 32-byte salt makes identical passwords hash differently even before bcrypt.
 * - Used for both login passwords and the 6-digit Financial PIN (separate salt per secret).
 */
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

const BCRYPT_COST = 12;

export interface HashedSecret {
  hash: string;
  salt: string;
}

function prehash(secret: string, salt: string): string {
  return crypto.createHmac('sha256', env.GLOBAL_SECRET_PEPPER).update(`${salt}:${secret}`, 'utf8').digest('base64');
}

export function generateSalt(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function hashSecret(secret: string): Promise<HashedSecret> {
  const salt = generateSalt();
  const hash = await bcrypt.hash(prehash(secret, salt), BCRYPT_COST);
  return { hash, salt };
}

let dummyHash: string | null = null;

export async function verifySecret(secret: string, stored: HashedSecret | undefined | null): Promise<boolean> {
  if (!stored?.hash || !stored?.salt) {
    // Burn equivalent CPU to avoid user-enumeration timing side channels.
    dummyHash ??= await bcrypt.hash('timing-equaliser', BCRYPT_COST);
    await bcrypt.compare(secret, dummyHash);
    return false;
  }
  return bcrypt.compare(prehash(secret, stored.salt), stored.hash);
}

export const PIN_REGEX = /^\d{6}$/;

export async function hashPin(pin: string): Promise<HashedSecret> {
  if (!PIN_REGEX.test(pin)) throw new Error('Financial PIN must be exactly 6 digits');
  return hashSecret(pin);
}

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function randomId(bytes = 16): string {
  return crypto.randomBytes(bytes).toString('hex');
}
