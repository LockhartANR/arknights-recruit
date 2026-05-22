import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import db from '../db.js';

const app = createApp();

// Clean up test data between tests
function cleanDb() {
  db.exec('DELETE FROM records');
  db.exec('DELETE FROM users');
}

describe('Auth API', () => {
  beforeAll(cleanDb);

  describe('POST /api/auth/register', () => {
    it('registers a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: '123456' });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeDefined();
      expect(res.body.username).toBe('testuser');
    });

    it('rejects duplicate username', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: '123456' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('已存在');
    });

    it('rejects empty username', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: '', password: '123456' });

      expect(res.status).toBe(400);
    });

    it('rejects short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'newuser', password: '12345' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('6位');
    });

    it('rejects invalid username characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'ab', password: '123456' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: '123456' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.username).toBe('testuser');
      expect(res.body.id).toBeDefined();
    });

    it('rejects wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('错误');
    });

    it('rejects non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nobody', password: '123456' });

      expect(res.status).toBe(401);
    });

    it('rejects empty credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: '', password: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/me', () => {
    let token;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: '123456' });
      token = res.body.token;
    });

    it('returns user info with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.username).toBe('testuser');
      expect(res.body.id).toBeDefined();
    });

    it('rejects without token', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    it('rejects malformed token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer bad-token-here');

      expect(res.status).toBe(401);
    });

    it('rejects wrong auth scheme', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Basic ${token}`);

      expect(res.status).toBe(401);
    });
  });
});

describe('Operators API', () => {
  describe('GET /api/operators', () => {
    it('returns operator list without auth', async () => {
      const res = await request(app).get('/api/operators');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});

describe('Records API', () => {
  let token;
  let otherToken;

  beforeAll(async () => {
    cleanDb();
    // Create first user
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', password: '123456' });
    const login1 = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: '123456' });
    token = login1.body.token;

    // Create second user
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'bob', password: '123456' });
    const login2 = await request(app)
      .post('/api/auth/login')
      .send({ username: 'bob', password: '123456' });
    otherToken = login2.body.token;
  });

  describe('POST /api/records', () => {
    it('creates a record with single star', async () => {
      const res = await request(app)
        .post('/api/records')
        .set('Authorization', `Bearer ${token}`)
        .send({ stars: 4 });

      expect(res.status).toBe(200);
      expect(res.body.stars).toBe(4);
      expect(res.body.count).toBe(1);
      expect(res.body.id).toBeDefined();
    });

    it('creates a record with operator_id', async () => {
      const res = await request(app)
        .post('/api/records')
        .set('Authorization', `Bearer ${token}`)
        .send({ stars: 6, operator_id: 'silverash' });

      expect(res.status).toBe(200);
      expect(res.body.stars).toBe(6);
      expect(res.body.operator_id).toBe('silverash');
    });

    it('rejects invalid star values', async () => {
      const res = await request(app)
        .post('/api/records')
        .set('Authorization', `Bearer ${token}`)
        .send({ stars: 7 });

      expect(res.status).toBe(400);
    });

    it('rejects null stars', async () => {
      const res = await request(app)
        .post('/api/records')
        .set('Authorization', `Bearer ${token}`)
        .send({ stars: null });

      expect(res.status).toBe(400);
    });

    it('rejects missing stars field', async () => {
      const res = await request(app)
        .post('/api/records')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/records')
        .send({ stars: 4 });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('未登录');
    });
  });

  describe('POST /api/records/batch', () => {
    it('creates multiple records', async () => {
      const res = await request(app)
        .post('/api/records/batch')
        .set('Authorization', `Bearer ${token}`)
        .send({ rows: [
          { stars: 3 },
          { stars: 5 },
          { stars: 6, operator_id: 'exusiai' }
        ]});

      expect(res.status).toBe(200);
      expect(res.body.imported).toBe(3);
    });

    it('skips invalid rows', async () => {
      const res = await request(app)
        .post('/api/records/batch')
        .set('Authorization', `Bearer ${token}`)
        .send({ rows: [
          { stars: 3 },
          { stars: 99 }
        ]});

      expect(res.status).toBe(200);
      expect(res.body.imported).toBe(1);
    });

    it('rejects empty rows array', async () => {
      const res = await request(app)
        .post('/api/records/batch')
        .set('Authorization', `Bearer ${token}`)
        .send({ rows: [] });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/records', () => {
    it('returns records for authenticated user', async () => {
      const res = await request(app)
        .get('/api/records')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(4);
      // Stars should be integer, not array
      expect(typeof res.body[0].stars).toBe('number');
    });

    it('respects limit parameter', async () => {
      const res = await request(app)
        .get('/api/records?limit=1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeLessThanOrEqual(1);
    });

    it('enforces data isolation between users', async () => {
      const res = await request(app)
        .get('/api/records')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/records');

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/records/:id', () => {
    it('edits a record star', async () => {
      const create = await request(app)
        .post('/api/records')
        .set('Authorization', `Bearer ${token}`)
        .send({ stars: 3 });
      const recordId = create.body.id;

      const res = await request(app)
        .put(`/api/records/${recordId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ stars: 5 });

      expect(res.status).toBe(200);
      expect(res.body.stars).toBe(5);
    });

    it('edits a record with operator_id', async () => {
      const create = await request(app)
        .post('/api/records')
        .set('Authorization', `Bearer ${token}`)
        .send({ stars: 4 });
      const recordId = create.body.id;

      const res = await request(app)
        .put(`/api/records/${recordId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ stars: 6, operator_id: 'amiya' });

      expect(res.status).toBe(200);
      expect(res.body.stars).toBe(6);
      expect(res.body.operator_id).toBe('amiya');
    });

    it('clears operator_id with null', async () => {
      const create = await request(app)
        .post('/api/records')
        .set('Authorization', `Bearer ${token}`)
        .send({ stars: 5, operator_id: 'texas' });
      const recordId = create.body.id;

      const res = await request(app)
        .put(`/api/records/${recordId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ stars: 5, operator_id: null });

      expect(res.status).toBe(200);
      expect(res.body.operator_id).toBeNull();
    });

    it('rejects invalid star in edit', async () => {
      const res = await request(app)
        .put('/api/records/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ stars: 7 });

      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent record', async () => {
      const res = await request(app)
        .put('/api/records/99999')
        .set('Authorization', `Bearer ${token}`)
        .send({ stars: 4 });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/records/:id', () => {
    it('deletes own record', async () => {
      const create = await request(app)
        .post('/api/records')
        .set('Authorization', `Bearer ${token}`)
        .send({ stars: 3 });
      const recordId = create.body.id;

      const res = await request(app)
        .delete(`/api/records/${recordId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('prevents cross-user deletion', async () => {
      const create = await request(app)
        .post('/api/records')
        .set('Authorization', `Bearer ${token}`)
        .send({ stars: 5 });
      const recordId = create.body.id;

      const res = await request(app)
        .delete(`/api/records/${recordId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(404);
    });

    it('returns 404 for non-existent record', async () => {
      const res = await request(app)
        .delete('/api/records/99999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).delete('/api/records/1');

      expect(res.status).toBe(401);
    });
  });
});

describe('Stats API', () => {
  let token;

  beforeAll(async () => {
    cleanDb();
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ username: 'statguy', password: '123456' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'statguy', password: '123456' });
    token = login.body.token;

    // Add records with known distribution using batch
    await request(app)
      .post('/api/records/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ rows: [
        { stars: 3 }, { stars: 4 }, { stars: 5 }, { stars: 6 },
        { stars: 3 }, { stars: 3 }
      ]});
  });

  describe('GET /api/records/stats/years', () => {
    it('returns available years for current user', async () => {
      const res = await request(app)
        .get('/api/records/stats/years')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('shows no years for user with no data', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({ username: 'empty', password: '123456' });
      const login = await request(app)
        .post('/api/auth/login')
        .send({ username: 'empty', password: '123456' });

      const res = await request(app)
        .get('/api/records/stats/years')
        .set('Authorization', `Bearer ${login.body.token}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/records/stats/years');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/records/stats', () => {
    it('requires year parameter', async () => {
      const res = await request(app)
        .get('/api/records/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it('returns correct star distribution for a year', async () => {
      const year = new Date().getFullYear();
      const res = await request(app)
        .get(`/api/records/stats?year=${year}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(6); // 3,4,5,6,3,3 = 6 total
      expect(res.body.breakdown).toHaveLength(4);

      // Star 3 should have count 3
      const star3 = res.body.breakdown.find(b => b.star === 3);
      expect(star3.count).toBe(3);
      // Percentages should sum to ~100
      const totalPct = res.body.breakdown.reduce((sum, b) => sum + b.percentage, 0);
      expect(totalPct).toBeCloseTo(100, 0);
    });

    it('returns correct stats with month filter', async () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');

      const res = await request(app)
        .get(`/api/records/stats?year=${year}&month=${month}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(6);
    });

    it('enforces data isolation in stats', async () => {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ username: 'empty', password: '123456' });

      const year = new Date().getFullYear();
      const res = await request(app)
        .get(`/api/records/stats?year=${year}`)
        .set('Authorization', `Bearer ${login.body.token}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
    });
  });
});

// Rate limiting is tested manually or in a separate integration environment
// where NODE_ENV !== 'test'. In test mode it is disabled to prevent
// interference between test suites.
