import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import authRouter from './routes/auth.js';
import recordsRouter from './routes/records.js';
import operatorsRouter from './routes/operators.js';

export function createApp() {
  const app = express();

  // Nginx sits in front of Express on the same host and injects X-Forwarded-For.
  // Without this, express-rate-limit cannot identify clients and falls back to
  // req.ip == 127.0.0.1, making every visitor share ONE rate-limit bucket
  // (20 auth requests per 15 min for the entire site). It also logs
  // ERR_ERL_UNEXPECTED_X_FORWARDED_FOR on every request.
  // 'loopback' trusts the header only when the peer is 127.0.0.1/::1, so it
  // cannot be spoofed by external clients.
  app.set('trust proxy', 'loopback');

  // Middleware
  app.use(helmet({
    // CSP disabled for SPA compatibility (Vite may inline scripts/styles)
    // Enable it after auditing with a proper nonce/hash policy if needed
    contentSecurityPolicy: false
  }));
  app.use(morgan('combined'));
  app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
  app.use(express.json({ limit: '1mb' }));

  // Rate limiting (disabled when running with test DB, e.g. :memory:)
  if (!process.env.DB_PATH) {
    app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));
    app.use('/api/records', rateLimit({ windowMs: 60 * 1000, max: 60 }));
  }

  // API routes
  app.use('/api/auth', authRouter);
  app.use('/api/records', recordsRouter);
  app.use('/api/operators', operatorsRouter);

  return app;
}
