import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, 'data.db');

const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance (skip for in-memory DB)
if (!process.env.DB_PATH || process.env.DB_PATH !== ':memory:') {
  db.pragma('journal_mode = WAL');
}
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stars TEXT NOT NULL,
    count INTEGER NOT NULL,
    created_at DATETIME DEFAULT (datetime('now', 'localtime'))
  )
`);

// Add user_id column to existing records table (ignore error if already exists)
try {
  db.exec('ALTER TABLE records ADD COLUMN user_id INTEGER REFERENCES users(id)');
} catch {
  // Column already exists, skip
}

// Add operator_id column (ignore error if already exists)
try {
  db.exec('ALTER TABLE records ADD COLUMN operator_id TEXT');
} catch {
  // Column already exists, skip
}

// Migrate: split legacy JSON-array rows into individual single-star rows
const legacyRows = db.prepare(
  "SELECT id, stars, count, created_at, user_id FROM records WHERE stars LIKE '[%'"
).all();

if (legacyRows.length > 0) {
  const insertWithDate = db.prepare(
    'INSERT INTO records (stars, count, user_id, operator_id, created_at) VALUES (?, 1, ?, NULL, ?)'
  );
  const insertNoDate = db.prepare(
    'INSERT INTO records (stars, count, user_id, operator_id) VALUES (?, 1, ?, NULL)'
  );
  const remove = db.prepare('DELETE FROM records WHERE id = ?');

  const migrate = db.transaction(() => {
    for (const row of legacyRows) {
      let starsArray;
      try {
        starsArray = JSON.parse(row.stars);
      } catch {
        continue;
      }
      if (!Array.isArray(starsArray)) continue;
      for (const star of starsArray) {
        if ([3, 4, 5, 6].includes(star)) {
          if (row.created_at) {
            insertWithDate.run(String(star), row.user_id, row.created_at);
          } else {
            insertNoDate.run(String(star), row.user_id);
          }
        }
      }
      remove.run(row.id);
    }
  });

  migrate();
  console.log(`Migrated ${legacyRows.length} legacy multi-star rows to individual rows`);
}

export default db;
