import { Router } from 'express';
import { z } from 'zod';
import { User, ROLES, type Role } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { hashPin, hashSecret, verifySecret } from '../security/cryptoGuard.js';
import {
  blacklist,
  consumeRefresh,
  signAccessToken,
  signDevGate,
  signRefreshToken,
  verifyRefresh,
  REFRESH_COOKIE,
} from '../security/tokens.js';
import { authenticate, requireRole, asyncH, HttpError, validate, devGate } from '../middleware/index.js';
import { env } from '../config/env.js';

export const authRouter = Router();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  devAccessKey: z.string().optional(),
});

authRouter.post(
  '/login',
  validate(LoginSchema),
  asyncH(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+password +isHiddenDev')
      .populate('employee');

    if (!user) throw new HttpError(401, 'Invalid credentials', 'AUTH_FAILED');

    // DEV accounts cannot log in via the regular public login route
    if (user.role === 'DEV' || user.isHiddenDev) {
      throw new HttpError(401, 'Invalid credentials', 'AUTH_FAILED');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpError(423, `Account locked. Try again after ${user.lockedUntil.toLocaleTimeString()}`, 'LOCKED');
    }

    const valid = await verifySecret(password, user.password as never);
    if (!valid) {
      user.failedLogins = (user.failedLogins || 0) + 1;
      if (user.failedLogins >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lock
      }
      await user.save();
      throw new HttpError(401, 'Invalid credentials', 'AUTH_FAILED');
    }

    user.failedLogins = 0;
    user.lockedUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = signAccessToken({
      sub: user._id.toString(),
      role: user.role,
      name: user.name,
      tv: user.tokenVersion,
    });

    const refresh = await signRefreshToken({
      sub: user._id.toString(),
      tv: user.tokenVersion,
    });

    res.cookie(REFRESH_COOKIE, refresh.token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: refresh.maxAgeMs,
      path: '/api/v1/auth',
    });

    res.json({
      accessToken,
      refreshToken: refresh.token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        employee: user.employee,
      },
    });
  }),
);

// DEV Gate Login: Only for hidden DEV portal
authRouter.post(
  '/dev-gate-login',
  validate(LoginSchema),
  asyncH(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase(), role: 'DEV' })
      .select('+password +isHiddenDev');

    if (!user || !user.isHiddenDev) {
      // 404 to avoid leaking system existence
      throw new HttpError(404, 'Not found');
    }

    const valid = await verifySecret(password, user.password as never);
    if (!valid) throw new HttpError(404, 'Not found');

    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = signAccessToken({
      sub: user._id.toString(),
      role: 'DEV',
      name: user.name,
      tv: user.tokenVersion,
    });

    const devGateToken = signDevGate(user._id.toString());
    const refresh = await signRefreshToken({
      sub: user._id.toString(),
      tv: user.tokenVersion,
    });

    res.cookie(REFRESH_COOKIE, refresh.token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: refresh.maxAgeMs,
      path: '/api/v1/auth',
    });

    res.json({
      accessToken,
      refreshToken: refresh.token,
      devGateToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: 'DEV',
      },
    });
  }),
);

// Refresh dual JWT with reuse detection
authRouter.post(
  '/refresh',
  asyncH(async (req, res) => {
    const raw = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
    if (!raw) throw new HttpError(401, 'No refresh token provided', 'NO_REFRESH');

    let claims;
    try {
      claims = verifyRefresh(raw);
    } catch {
      res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
      throw new HttpError(401, 'Invalid refresh token', 'INVALID_REFRESH');
    }

    const user = await User.findById(claims.sub);
    if (!user || !user.active || user.tokenVersion !== claims.tv) {
      res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
      throw new HttpError(401, 'Session invalid', 'SESSION_REVOKED');
    }

    const consumed = await consumeRefresh(claims.jti);
    if (!consumed) {
      // Token reuse detected! Invalidate all sessions for this user (defense in depth)
      user.tokenVersion += 1;
      await user.save();
      res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
      throw new HttpError(401, 'Refresh token reuse detected — session terminated', 'TOKEN_STOLEN');
    }

    const accessToken = signAccessToken({
      sub: user._id.toString(),
      role: user.role,
      name: user.name,
      tv: user.tokenVersion,
      imp: claims.imp,
    });

    const newRefresh = await signRefreshToken({
      sub: user._id.toString(),
      tv: user.tokenVersion,
      fam: claims.fam,
      imp: claims.imp,
    });

    res.cookie(REFRESH_COOKIE, newRefresh.token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: newRefresh.maxAgeMs,
      path: '/api/v1/auth',
    });

    res.json({ accessToken, refreshToken: newRefresh.token });
  }),
);

authRouter.post(
  '/logout',
  authenticate,
  asyncH(async (req, res) => {
    if (req.auth) {
      await blacklist(req.auth.jti, req.auth.exp, 'logout');
    }
    const raw = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
    if (raw) {
      try {
        const c = verifyRefresh(raw);
        await consumeRefresh(c.jti);
      } catch {
        // ignore
      }
    }
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncH(async (req, res) => {
    const user = await User.findById(req.auth!.sub)
      .populate('employee')
      .lean();
    if (!user) throw new HttpError(404, 'User not found');
    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: req.auth!.role,
        phone: user.phone,
        employee: user.employee,
        impersonatedBy: req.auth!.imp,
      },
    });
  }),
);

// Impersonation Engine (DEV portal only)
authRouter.post(
  '/impersonate',
  authenticate,
  devGate,
  validate(z.object({ targetRole: z.enum(ROLES) })),
  asyncH(async (req, res) => {
    const { targetRole } = req.body;
    let targetUser = await User.findOne({ role: targetRole, active: true }).populate('employee');
    if (!targetUser) {
      throw new HttpError(404, `No active user found for role ${targetRole}`);
    }

    const accessToken = signAccessToken(
      {
        sub: targetUser._id.toString(),
        role: targetRole,
        name: targetUser.name,
        tv: targetUser.tokenVersion,
        imp: req.auth!.sub,
      },
      '2h',
    );

    res.json({
      accessToken,
      user: {
        id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetRole,
        employee: targetUser.employee,
        impersonatedBy: req.auth!.sub,
      },
    });
  }),
);

// Quick-Switch Engine for local demo / testing bar
authRouter.post(
  '/quick-switch',
  validate(z.object({ targetRole: z.enum(ROLES) })),
  asyncH(async (req, res) => {
    if (!env.ALLOW_LOCAL_QUICK_SWITCH) {
      throw new HttpError(403, 'Quick-switch is disabled');
    }
    const { targetRole } = req.body;
    let query: Record<string, unknown> = { role: targetRole, active: true };
    if (targetRole === 'DEV') {
      query = { role: 'DEV' };
    }

    const user = await User.findOne(query).select('+isHiddenDev').populate('employee');
    if (!user) throw new HttpError(404, `No seeded user found for role ${targetRole}`);

    const accessToken = signAccessToken({
      sub: user._id.toString(),
      role: targetRole,
      name: user.name,
      tv: user.tokenVersion,
    });

    let devGateToken: string | undefined;
    if (targetRole === 'DEV') {
      devGateToken = signDevGate(user._id.toString());
    }

    const refresh = await signRefreshToken({
      sub: user._id.toString(),
      tv: user.tokenVersion,
    });

    res.cookie(REFRESH_COOKIE, refresh.token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: refresh.maxAgeMs,
      path: '/api/v1/auth',
    });

    res.json({
      accessToken,
      refreshToken: refresh.token,
      devGateToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        employee: user.employee,
      },
    });
  }),
);

// Change password / Set financial PIN
authRouter.post(
  '/set-pin',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  validate(z.object({ pin: z.string().regex(/^\d{6}$/) })),
  asyncH(async (req, res) => {
    const hashed = await hashPin(req.body.pin);
    await User.findByIdAndUpdate(req.auth!.sub, { financialPin: hashed });
    res.json({ ok: true, message: 'Financial PIN updated' });
  }),
);
