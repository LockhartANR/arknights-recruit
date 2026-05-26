import { Router } from 'express';
import db from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// POST /api/records - create a record
router.post('/', (req, res) => {
  try {
    const { stars, operator_id, created_at } = req.body;

    if (stars === undefined || stars === null) {
      return res.status(400).json({ error: '请输入星级' });
    }

    const star = parseInt(stars);
    if (![1, 2, 3, 4, 5, 6].includes(star)) {
      return res.status(400).json({ error: '星级只能是 1-6' });
    }

    // Validate optional operator_id
    if (operator_id !== undefined && operator_id !== null && typeof operator_id !== 'string') {
      return res.status(400).json({ error: 'operator_id 格式错误' });
    }

    // Validate optional created_at
    let dateValue = null;
    if (created_at) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(created_at)) {
        return res.status(400).json({ error: '日期格式错误，需为 YYYY-MM-DD' });
      }
      const d = new Date(created_at);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ error: '无效的日期' });
      }
      dateValue = created_at + ' 00:00:00';
    }

    if (dateValue) {
      const stmt = db.prepare('INSERT INTO records (stars, count, user_id, operator_id, created_at) VALUES (?, 1, ?, ?, ?)');
      const result = stmt.run(String(star), req.user.id, operator_id || null, dateValue);
      res.json({ id: result.lastInsertRowid, stars: star, operator_id: operator_id || null, count: 1 });
    } else {
      const stmt = db.prepare('INSERT INTO records (stars, count, user_id, operator_id) VALUES (?, 1, ?, ?)');
      const result = stmt.run(String(star), req.user.id, operator_id || null);
      res.json({ id: result.lastInsertRowid, stars: star, operator_id: operator_id || null, count: 1 });
    }
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/records/batch - create multiple records (for CSV import etc.)
router.post('/batch', (req, res) => {
  try {
    const { rows } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: '请提供有效的记录数组' });
    }

    const insertWithDate = db.prepare(
      'INSERT INTO records (stars, count, user_id, operator_id, created_at) VALUES (?, 1, ?, ?, ?)'
    );
    const insertNoDate = db.prepare(
      'INSERT INTO records (stars, count, user_id, operator_id) VALUES (?, 1, ?, ?)'
    );

    let imported = 0;
    const txn = db.transaction(() => {
      for (const row of rows) {
        const { stars, operator_id, created_at } = row;

        if (stars === undefined || stars === null) continue;
        const star = parseInt(stars);
        if (![1, 2, 3, 4, 5, 6].includes(star)) continue;

        let dateValue = null;
        if (created_at) {
          // Accept both "YYYY-MM-DD" and "YYYY-MM-DD HH:mm:ss" formats
          const dateStr = String(created_at).slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(new Date(dateStr).getTime())) {
            dateValue = dateStr + ' 00:00:00';
          } else {
            continue; // Invalid date, skip
          }
        }

        if (dateValue) {
          insertWithDate.run(String(star), req.user.id, operator_id || null, dateValue);
        } else {
          insertNoDate.run(String(star), req.user.id, operator_id || null);
        }
        imported++;
      }
    });

    txn();
    res.json({ imported });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/records - list records (supports ?offset=&limit=&stars=&operator_id=&date_from=&date_to=)
router.get('/', (req, res) => {
  try {
    const offset = req.query.offset !== undefined ? parseInt(req.query.offset) : null;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    // Build dynamic WHERE clause from filters
    const conditions = ['user_id = ?'];
    const params = [req.user.id];

    if (req.query.stars) {
      const stars = req.query.stars.split(/[,\s，]+/).filter(s => ['1', '2', '3', '4', '5', '6'].includes(s));
      if (stars.length > 0) {
        conditions.push(`stars IN (${stars.map(() => '?').join(',')})`);
        params.push(...stars);
      }
    }

    if (req.query.operator_id) {
      conditions.push('operator_id = ?');
      params.push(req.query.operator_id);
    }

    if (req.query.date_from) {
      conditions.push('created_at >= ?');
      params.push(req.query.date_from + ' 00:00:00');
    }

    if (req.query.date_to) {
      conditions.push('created_at <= ?');
      params.push(req.query.date_to + ' 23:59:59');
    }

    const whereClause = conditions.join(' AND ');

    if (offset !== null) {
      // Paginated mode: return { records, total }
      const totalRow = db.prepare(
        `SELECT COUNT(*) as total FROM records WHERE ${whereClause}`
      ).get(...params);
      const records = db.prepare(
        `SELECT id, stars, count, operator_id, created_at FROM records WHERE ${whereClause} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
      ).all(...params, limit, offset);
      return res.json({
        records: records.map(r => ({ ...r, stars: parseInt(r.stars) })),
        total: totalRow.total
      });
    }

    // Simple mode: return array (backwards compatible)
    const records = db.prepare(
      `SELECT id, stars, count, operator_id, created_at FROM records WHERE ${whereClause} ORDER BY created_at DESC, id DESC LIMIT ?`
    ).all(...params, limit);

    res.json(records.map(r => ({ ...r, stars: parseInt(r.stars) })));
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// GET /api/records/export - export all records (no limit)
router.get('/export', (req, res) => {
  try {
    const records = db.prepare(
      'SELECT id, stars, count, operator_id, created_at FROM records WHERE user_id = ? ORDER BY created_at DESC, id DESC'
    ).all(req.user.id);
    res.json(records.map(r => ({ ...r, stars: parseInt(r.stars) })));
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// DELETE /api/records/all - delete all records for current user
router.delete('/all', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM records WHERE user_id = ?').run(req.user.id);
    res.json({ deleted: result.changes });
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

// PUT /api/records/:id - edit a record's star, operator, and optionally its date
router.put('/:id', (req, res) => {
  try {
    const { stars, operator_id, created_at } = req.body;

    if (stars === undefined || stars === null) {
      return res.status(400).json({ error: '请输入星级' });
    }

    const star = parseInt(stars);
    if (![1, 2, 3, 4, 5, 6].includes(star)) {
      return res.status(400).json({ error: '星级只能是 1-6' });
    }

    let dateValue = null;
    if (created_at) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(created_at) || isNaN(new Date(created_at).getTime())) {
        return res.status(400).json({ error: '日期格式错误，需为 YYYY-MM-DD' });
      }
      dateValue = created_at + ' 00:00:00';
    }

    // Build dynamic UPDATE
    const setClauses = ['stars = ?'];
    const params = [String(star)];

    // operator_id: undefined = keep existing, null = clear, string = set
    if (operator_id !== undefined) {
      setClauses.push('operator_id = ?');
      params.push(operator_id);
    }

    if (dateValue) {
      setClauses.push('created_at = ?');
      params.push(dateValue);
    }

    params.push(req.params.id, req.user.id);

    const result = db.prepare(
      `UPDATE records SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`
    ).run(...params);

    if (result.changes === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }

    // Return updated record
    const updated = db.prepare('SELECT id, stars, operator_id FROM records WHERE id = ?').get(req.params.id);
    res.json({
      id: updated.id,
      stars: parseInt(updated.stars),
      operator_id: updated.operator_id,
      count: 1
    });
  } catch (err) {
    res.status(500).json({ error: '服务器错误' });
  }
});

// POST /api/records/delete-batch - batch delete records
router.post('/delete-batch', (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '请提供要删除的记录 ID' });
    }

    const placeholders = ids.map(() => '?').join(',');
    const result = db.prepare(
      `DELETE FROM records WHERE id IN (${placeholders}) AND user_id = ?`
    ).run(...ids, req.user.id);

    res.json({ deleted: result.changes });
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

    let rows;
    if (month) {
      rows = db.prepare(`
        SELECT stars, COUNT(*) as cnt FROM records
        WHERE user_id = ? AND strftime('%Y', created_at) = ? AND strftime('%m', created_at) = ?
        GROUP BY stars
      `).all(req.user.id, year, String(month).padStart(2, '0'));
    } else {
      rows = db.prepare(`
        SELECT stars, COUNT(*) as cnt FROM records
        WHERE user_id = ? AND strftime('%Y', created_at) = ?
        GROUP BY stars
      `).all(req.user.id, year);
    }

    // Build star counts
    const starCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    for (const row of rows) {
      const star = parseInt(row.stars);
      if (starCounts.hasOwnProperty(star)) {
        starCounts[star] = row.cnt;
      }
    }

    const total = Object.values(starCounts).reduce((a, b) => a + b, 0);

    const breakdown = [1, 2, 3, 4, 5, 6].map(star => ({
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
