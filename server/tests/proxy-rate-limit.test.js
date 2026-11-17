import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import '../db.js';

/**
 * Regression tests for rate limiting behind the nginx reverse proxy.
 *
 * The production defect: nginx sets X-Forwarded-For, but Express' `trust proxy`
 * was left at its default (false). express-rate-limit therefore could not
 * identify clients and keyed every request on req.ip === 127.0.0.1, so the
 * entire site shared a single 20-requests-per-15-minutes budget for /api/auth.
 * One visitor could lock out login and registration for everyone.
 *
 * These tests enable the limiter (which app.js gates on DB_PATH being unset)
 * while still using the in-memory database opened at import time, then assert
 * that distinct forwarded clients get independent budgets.
 */

// The limiter's store is shared across the whole file, so every test must use
// its own client IP. Reusing one would let an earlier test consume a later
// test's budget and produce a false failure.
const CLIENT_HEADERS = '203.0.113.10';
const CLIENT_BURNER = '203.0.113.11';
const CLIENT_VICTIM = '203.0.113.12';
const CLIENT_COUNTER = '203.0.113.13';
const AUTH_MAX = 20;

function limitHeaders(res) {
  // express-rate-limit emits the legacy X-RateLimit-* headers in this version.
  const limit = Number(res.headers['x-ratelimit-limit'] ?? res.headers['ratelimit-limit']);
  const remaining = Number(
    res.headers['x-ratelimit-remaining'] ?? res.headers['ratelimit-remaining']
  );
  return { limit, remaining };
}

describe('Rate limiting behind the nginx proxy', () => {
  const savedDbPath = process.env.DB_PATH;
  let app;

  beforeAll(() => {
    // Empty string makes app.js's `!process.env.DB_PATH` gate true, enabling the
    // limiters. db.js already opened ':memory:' during import, so no file is used.
    process.env.DB_PATH = '';
    app = createApp();
  });

  afterAll(() => {
    process.env.DB_PATH = savedDbPath;
  });

  it('declares trust in the loopback proxy hop', () => {
    expect(app.get('trust proxy')).toBe('loopback');
  });

  it('emits rate-limit headers on auth routes', async () => {
    const res = await request(app).get('/api/auth/me').set('X-Forwarded-For', CLIENT_HEADERS);

    expect(res.status).toBe(401); // no token, but it passed through the limiter
    const { limit } = limitHeaders(res);
    expect(limit).toBe(AUTH_MAX);
  });

  it("does not leak one client's usage into another client's budget", async () => {
    // Burn three requests as the burner client.
    for (let i = 0; i < 3; i += 1) {
      await request(app).get('/api/auth/me').set('X-Forwarded-For', CLIENT_BURNER);
    }

    // The victim has made no requests, so it must still see a full budget minus
    // its own single request. Before the fix this returned 20 - 1 - 4 = 15,
    // because the burner's requests were charged to the shared 127.0.0.1 bucket.
    const res = await request(app).get('/api/auth/me').set('X-Forwarded-For', CLIENT_VICTIM);
    const { remaining } = limitHeaders(res);

    expect(remaining).toBe(AUTH_MAX - 1);
  });

  it('counts repeated requests from the same client down', async () => {
    const first = await request(app).get('/api/auth/me').set('X-Forwarded-For', CLIENT_COUNTER);
    const second = await request(app).get('/api/auth/me').set('X-Forwarded-For', CLIENT_COUNTER);

    const a = limitHeaders(first).remaining;
    const b = limitHeaders(second).remaining;

    expect(b).toBe(a - 1);
  });
});
