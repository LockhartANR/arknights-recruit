import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// POST /api/records - create one or more records
router.post('/', (req, res) => {
  try {
    const { stars } = req.body;

    if (!Array.isArray(stars) || stars.length === 0) {
      return res.status(400).json({ error: '请输入有效的星级数组' });
    }

    for (const s of stars) {
      if (![3, 4, 5, 6].includes(s)) {
        return res.status(400).json({ error: '星级只能是 3, 4, 5, 6' });
      }
    }

    const stmt = db.prepare('INSERT INTO records (stars, count, user_id) VALUES (?, ?, ?)');
    const result = stmt.run(JSON.stringify(stars), stars.length, req.user.id);

    res.json({
      id: result.lastInsertRowid,
      stars,
      count: stars.length
    });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/records - list recent records
router.get('/', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const records = db.prepare(
      'SELECT id, stars, count, created_at FROM records WHERE user_id = ? ORDER BY id DESC LIMIT ?'
    ).all(req.user.id, limit);

    const parsed = records.map(r => ({
      ...r,
      stars: JSON.parse(r.stars)
    }));

    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/records/:id - delete a record
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare(
      'DELETE FROM records WHERE id = ? AND user_id = ?'
    ).run(req.params.id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/records/stats/years - list all years with data
router.get('/stats/years', (req, res) => {
  try {
    const years = db.prepare(
      "SELECT DISTINCT strftime('%Y', created_at) AS year FROM records WHERE user_id = ? ORDER BY year DESC"
    ).all(req.user.id);
    res.json(years.map(r => r.year));
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/records/stats?year=YYYY[&month=MM] - get stats breakdown
router.get('/stats', (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year) {
      return res.status(400).json({ error: '请提供年份参数' });
    }

    let records;
    if (month) {
      records = db.prepare(`
        SELECT stars FROM records
        WHERE user_id = ? AND strftime('%Y', created_at) = ? AND strftime('%m', created_at) = ?
      `).all(req.user.id, year, String(month).padStart(2, '0'));
    } else {
      records = db.prepare(`
        SELECT stars FROM records
        WHERE user_id = ? AND strftime('%Y', created_at) = ?
      `).all(req.user.id, year);
    }

    // Aggregate star counts
    const starCounts = { 3: 0, 4: 0, 5: 0, 6: 0 };
    let total = 0;

    for (const row of records) {
      const stars = JSON.parse(row.stars);
      for (const s of stars) {
        if (starCounts.hasOwnProperty(s)) {
          starCounts[s]++;
          total++;
        }
      }
    }

    const breakdown = [3, 4, 5, 6].map(star => ({
      star,
      count: starCounts[star],
      percentage: total > 0 ? Math.round((starCounts[star] / total) * 1000) / 10 : 0
    }));

    res.json({ total, breakdown });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

export default router;
