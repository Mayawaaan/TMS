import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import path from 'node:path';
import multer from 'multer';
import { fileURLToPath } from 'node:url';

import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { startWorkers } from './queues/index.js';
import { auditTrail, errorHandler, authenticate, asyncH, HttpError } from './middleware/index.js';

import { authRouter } from './routes/auth.routes.js';
import { businessRouter } from './routes/business.routes.js';
import { fleetRouter } from './routes/fleet.routes.js';
import { freightsRouter } from './routes/freights.routes.js';
import { financeRouter } from './routes/finance.routes.js';
import { payrollRouter } from './routes/payroll.routes.js';
import { analyticsRouter } from './routes/analytics.routes.js';
import { driverRouter } from './routes/driver.routes.js';
import { searchRouter } from './routes/search.routes.js';
import { sysInternalRouter } from './routes/sysInternal.routes.js';

const app = express();
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uploadsDir = path.join(rootDir, 'uploads');

// File Upload config
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Security & Parsing Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow localhost dev portals and same origin
      if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        callback(null, true);
      } else {
        callback(null, env.WEB_ORIGIN);
      }
    },
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(compression());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

if (env.NODE_ENV !== 'test') {
  app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));
}

// Static Uploads
app.use('/uploads', express.static(uploadsDir));

// Audit trail on all mutations
app.use(auditTrail);

// File upload endpoint (requires auth)
app.post(
  '/api/v1/upload',
  authenticate,
  upload.single('file'),
  asyncH(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'No file uploaded');
    const url = `/uploads/${req.file.filename}`;
    res.json({
      url,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
    });
  }),
);

// Health check
app.get(['/health', '/api/v1/health'], (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Ensure DB is ready before processing API requests (prevents proxy 500s during hot-reload)
app.use('/api/v1', asyncH(async (_req, _res, next) => {
  await connectDB();
  next();
}));

// Core API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/business', businessRouter);
app.use('/api/v1/fleet', fleetRouter);
app.use('/api/v1/freights', freightsRouter);
app.use('/api/v1/finance', financeRouter);
app.use('/api/v1/payroll', payrollRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/driver', driverRouter);
app.use('/api/v1/search', searchRouter);
app.use('/api/v1/sys-internal', sysInternalRouter);

// Global Error Handler
app.use(errorHandler);

// Bootstrap
export async function startServer() {
  const server = await new Promise((resolve) => {
    const s = app.listen(env.API_PORT, '0.0.0.0', () => {
      console.log(`[api-core] Server running on http://localhost:${env.API_PORT} and http://127.0.0.1:${env.API_PORT} (${env.NODE_ENV})`);
      resolve(s);
    });
  });

  await connectDB();
  await startWorkers();

  return server;
}

// Self-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('server.ts')) {
  startServer().catch((err) => {
    console.error('[server] Fatal bootstrap error:', err);
    process.exit(1);
  });
}
