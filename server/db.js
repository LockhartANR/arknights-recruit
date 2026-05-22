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

export default db;
