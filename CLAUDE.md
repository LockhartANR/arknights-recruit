# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
# Start backend (Express, port 3000)
cd server && node index.js

# Start frontend dev server (Vite, port 5173, proxies /api → :3000)
cd client && npm run dev

# Production build + serve
cd client && npx vite build && cd ../server && node index.js

# Backend API tests (vitest + supertest, 43 cases)
cd server && npm test

# Frontend E2E tests (Playwright, 21 cases)
cd client && npm run test:e2e
```

## Architecture

Full-stack multi-user app: Vue 3 SPA → Express REST API → SQLite. JWT auth (jsonwebtoken + bcryptjs) with Pinia state management.

**Three pages**, routed via vue-router with auth guard:
- `/` — InputPage: manual star entry (comma-separated 1-6), recent records, JSON export, CSV import
- `/records` — RecordsPage: paginated table with inline edit (star + date), filter bar (stars/operator/date range), checkbox batch delete, delete all
- `/statistics` — StatisticsPage: year/month selector, ECharts pie charts + tables
- `/login`, `/register` — auth pages (no guard)

**Data flow**: Components use `api()` from `client/src/utils/api.js` (auto-attaches `Authorization: Bearer <token>`, 401 triggers logout). The `useStats.js` composable handles stats fetching. `stores/auth.js` (Pinia) manages auth state, initializes from localStorage on page load.

**Backend** — `server/app.js` creates the Express app (helmet, morgan, rate-limit, CORS, JSON parser); `server/index.js` adds static serving + SPA fallback and starts listening. Route files:

| File | Key endpoints |
|------|--------------|
| `routes/auth.js` | `POST /api/auth/register`, `/login`, `GET /me` |
| `routes/records.js` | `GET /` (paginated `?offset=&limit=` + filter `?stars=&operator_id=&date_from=&date_to=`), `POST /` (with optional `created_at`), `POST /batch` (CSV import), `PUT /:id` (edit stars + date), `DELETE /:id`, `POST /delete-batch` (`{ids:[...]}`), `DELETE /all`, `GET /stats`, `GET /stats/years` |

All records routes are behind `authMiddleware` which verifies JWT and sets `req.user`. SQL queries filter by `user_id`.

**Database** — SQLite (`server/data.db`), auto-created. Two tables:
```sql
users (id INTEGER PK, username TEXT UNIQUE, password_hash TEXT, created_at DATETIME)
records (id INTEGER PK, stars TEXT, count INTEGER, user_id INTEGER REFERENCES users, created_at DATETIME)
```
`stars` is stored as a JSON array string. WAL mode enabled. In tests, `DB_PATH=:memory:` uses an in-memory DB. `DISABLE_RATE_LIMIT` env var skips rate limiting (set in vitest.config.js and start-e2e.js).

**Testing**: Backend tests use vitest + supertest with in-memory DB. E2E tests use Playwright with two `webServer` entries (backend on 3000, Vite on 5173), `workers: 1` for serial execution. Test auth via `page.request.post` to backend + `page.addInitScript` for localStorage injection. `start-e2e.js` uses dynamic `import()` because ESM static imports are hoisted before env var setup.

**Production**: Express serves `client/dist/` as static files with SPA fallback. `update.sh` handles `git pull → npm install → vite build → pm2 restart`. Helmet is configured with strictTransportSecurity/CSP/crossOriginOpenerPolicy disabled until HTTPS is set up.

**Data sync** — `sync-operators.js` pulls operator data from [PRTS-fetcher](https://github.com/LockhartANR/PRTS-fetcher). Run `node --use-system-ca sync-operators.js` to fetch operators.json + avatars from GitHub; `node sync-operators.js --local` reads from `../prts-fetcher/output/` as fallback.
