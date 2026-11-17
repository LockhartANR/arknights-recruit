// Local development only: configure before importing the application.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, '.env') });
if (!process.env.JWT_SECRET || !process.env.INVITE_CODE) throw new Error('Copy .env.example to .env and set local values');
process.env.DB_PATH = path.join(here, 'development.db');
process.env.PORT = '3000';
process.env.CORS_ORIGIN = 'http://localhost:5173';
await import('./index.js');

