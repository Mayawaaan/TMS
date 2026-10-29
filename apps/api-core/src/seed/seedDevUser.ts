import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { hashSecret, hashPin } from '../security/cryptoGuard.js';

export async function seedDevUser() {
  await connectDB();

  console.log(`[seed:dev] Provisioning hidden system architect DEV account: ${env.SEED_DEV_EMAIL}...`);

  const password = await hashSecret(env.SEED_DEV_PASSWORD);
  const financialPin = await hashPin(env.SEED_FINANCIAL_PIN);

  await User.deleteOne({ email: env.SEED_DEV_EMAIL.toLowerCase() });

  const devUser = await User.create({
    name: 'Principal Systems Architect',
    email: env.SEED_DEV_EMAIL.toLowerCase(),
    phone: '+91 98930 00000',
    role: 'DEV',
    password,
    financialPin,
    isHiddenDev: true,
    active: true,
  });

  console.log(`[seed:dev] ✓ DEV Account provisioned successfully! ID: ${devUser._id}`);
  console.log(`[seed:dev] Email: ${env.SEED_DEV_EMAIL}`);
  console.log(`[seed:dev] Password: ${env.SEED_DEV_PASSWORD}`);
  console.log(`[seed:dev] Portal Route: /sys-internal-dev`);
}

if (process.argv[1] && process.argv[1].endsWith('seedDevUser.ts')) {
  seedDevUser()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed:dev] Failed:', err);
      process.exit(1);
    });
}
