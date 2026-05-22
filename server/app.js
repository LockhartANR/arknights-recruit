import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import authRouter from './routes/auth.js';
import recordsRouter from './routes/records.js';

export function createApp() {
  const app = express();

  // Middleware
  app.use(helmet());
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

  return app;
}
