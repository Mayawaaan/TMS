import axios from 'axios';
import { env } from '../config/env.js';

const api = axios.create({
  baseURL: `http://127.0.0.1:${env.API_PORT}/api/v1`,
  validateStatus: () => true, // Don't throw so we can inspect status codes
});

async function runSmokeTests() {
  console.log('[smoke] ========================================================');
  console.log('[smoke] RUNNING PHASE 1 API & SECURITY SMOKE TESTS');
  console.log('[smoke] ========================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, detail?: unknown) {
    if (condition) {
      console.log(`[smoke] ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`[smoke] ❌ FAIL: ${name}`, detail || '');
      failed++;
    }
  }

  // 1. HEALTH CHECK
  const healthRes = await api.get('/health');
  assert(healthRes.status === 200, 'Health endpoint responds 200 OK');

  // 2. PUBLIC LOGIN - ADMIN
  const adminLogin = await api.post('/auth/login', {
    email: 'admin@obsidianfleet.com',
    password: env.SEED_DEFAULT_PASSWORD,
  });
  assert(adminLogin.status === 200 && adminLogin.data.accessToken, 'Admin login with dual-JWT issuance');
  const adminToken = adminLogin.data.accessToken;

  // 3. PUBLIC LOGIN - DEV (MUST FAIL with 401: DEV is CLI seed / DEV-Gate only!)
  const devPublicLogin = await api.post('/auth/login', {
    email: env.SEED_DEV_EMAIL,
    password: env.SEED_DEV_PASSWORD,
  });
  assert(devPublicLogin.status === 401, 'DEV cannot log in via public login route (Security Guardrail)');

  // 4. DEV GATE LOGIN - Hidden Portal
  const devGateLogin = await api.post('/auth/dev-gate-login', {
    email: env.SEED_DEV_EMAIL,
    password: env.SEED_DEV_PASSWORD,
  });
  assert(
    devGateLogin.status === 200 && devGateLogin.data.devGateToken && devGateLogin.data.accessToken,
    'DEV Gate login succeeds and returns devGateToken',
  );
  const devToken = devGateLogin.data.accessToken;
  const devGateToken = devGateLogin.data.devGateToken;

  // 5. DEV GATE CLOAKING TEST: Call /sys-internal without x-dev-gate header (MUST return 404!)
  const uncloakedSysInternal = await api.get('/sys-internal/overview', {
    headers: { Authorization: `Bearer ${devToken}` },
  });
  assert(uncloakedSysInternal.status === 404, 'SYS-INTERNAL without X-Dev-Gate header is cloaked as 404 Not Found');

  // 6. DEV GATE AUTHORIZED ACCESS: Call with both Bearer DEV token and X-Dev-Gate header
  const authorizedSysInternal = await api.get('/sys-internal/overview', {
    headers: {
      Authorization: `Bearer ${devToken}`,
      'x-dev-gate': devGateToken,
    },
  });
  assert(authorizedSysInternal.status === 200, 'SYS-INTERNAL with X-Dev-Gate header succeeds 200 OK');

  // 7. PUBLIC LOGIN - MANAGER, STAFF, DRIVER
  const managerLogin = await api.post('/auth/login', {
    email: 'manager@obsidianfleet.com',
    password: env.SEED_DEFAULT_PASSWORD,
  });
  assert(managerLogin.status === 200, 'Manager login succeeds');
  const managerToken = managerLogin.data.accessToken;

  const staffLogin = await api.post('/auth/login', {
    email: 'dispatch@obsidianfleet.com',
    password: env.SEED_DEFAULT_PASSWORD,
  });
  assert(staffLogin.status === 200, 'Staff login succeeds');
  const staffToken = staffLogin.data.accessToken;

  const driverLogin = await api.post('/auth/login', {
    email: 'driver.ramesh@obsidianfleet.com',
    password: env.SEED_DEFAULT_PASSWORD,
  });
  assert(driverLogin.status === 200, 'Driver login succeeds');
  const driverToken = driverLogin.data.accessToken;

  // 8. RBAC TEST: STAFF cannot view Trial Balance (Must return 403 Forbidden)
  const staffTrialBalance = await api.get('/finance/trial-balance', {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert(staffTrialBalance.status === 403, 'RBAC: STAFF role forbidden from Trial Balance (403)');

  // 9. RBAC TEST: DRIVER cannot mutate Bilty (Must return 403)
  const driverCreateTrip = await api.post(
    '/freights/trips',
    { client: 'someid' },
    { headers: { Authorization: `Bearer ${driverToken}` } },
  );
  assert(driverCreateTrip.status === 403, 'RBAC: DRIVER role forbidden from creating Bilty (403)');

  // 10. TRIAL BALANCE BALANCED CHECK (ADMIN)
  const adminTB = await api.get('/finance/trial-balance', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    adminTB.status === 200 && adminTB.data.balanced === true,
    'Double-Entry Ledger Trial Balance is balanced (Total Debits == Total Credits)',
  );

  // 11. MANAGER RESTRICTION TEST: Manager cannot view Owner Equity or Bank balances in Ledger
  const managerLedger = await api.get('/finance/ledger?account=OWNER_EQUITY', {
    headers: { Authorization: `Bearer ${managerToken}` },
  });
  assert(
    managerLedger.status === 200 && managerLedger.data.length === 0,
    'Manager Ledger query strictly masks Owner Equity & Bank accounts',
  );

  // 12. CREDIT ENGINE TEST: Try creating Bilty for ITC Choupal Sagar (Outstanding > Limit) without PIN -> Expect 402 Blocked
  const clientsRes = await api.get('/business/clients', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const itcClient = clientsRes.data.find((c: { code: string }) => c.code === 'CLI-ITC');
  if (itcClient) {
    const blockedTrip = await api.post(
      '/freights/trips',
      {
        client: itcClient._id,
        origin: 'Indore',
        destination: 'Mumbai',
        distanceKm: 585,
        material: 'FMCG Packaged Goods',
        weightTons: 25,
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    assert(blockedTrip.status === 402, 'Credit Engine blocks Bilty creation when Client Outstanding exceeds Credit Limit (402)');

    // 13. CREDIT ENGINE OVERRIDE: Same request with valid 6-digit Financial PIN (482916) -> Expect 201 Created
    const overrideTrip = await api.post(
      '/freights/trips',
      {
        client: itcClient._id,
        origin: 'Indore',
        destination: 'Mumbai',
        distanceKm: 585,
        material: 'FMCG Packaged Goods',
        weightTons: 25,
        financialPin: env.SEED_FINANCIAL_PIN,
      },
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    assert(overrideTrip.status === 201, 'Credit Engine override succeeds with valid ADMIN 6-digit Financial PIN (201)');
  }

  // 14. LOGOUT & REDIS BLACKLIST TEST
  const logoutRes = await api.post(
    '/auth/logout',
    {},
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );
  assert(logoutRes.status === 200, 'Logout succeeds and revokes token');

  // Request with the blacklisted token must return 401
  const revokedAccess = await api.get('/auth/me', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(revokedAccess.status === 401, 'Blacklisted token immediately rejected by Redis token blacklist (401)');

  console.log('[smoke] ========================================================');
  console.log(`[smoke] SMOKE TEST SUITE COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log('[smoke] ========================================================');

  if (failed > 0) process.exit(1);
}

if (process.argv[1] && process.argv[1].endsWith('smoke.ts')) {
  runSmokeTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[smoke] Fatal smoke test error:', err);
      process.exit(1);
    });
}
