# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
# Start backend (Express, port 3000)
cd server && node index.js

# Start frontend dev server (Vite, port 5173, proxies /api → :3000)
cd client && npm run dev

# Production build
cd client && npx vite build
# Then serve: cd server && node index.js (Express serves client/dist/)
```

## Architecture

Full-stack app: Vue 3 SPA → Express REST API → SQLite.

**Two pages**, routed client-side via vue-router:
- `/` — InputPage: text input for comma-separated star ratings (3-6), recent records list, JSON import/export
- `/statistics` — StatisticsPage: year/month selector, ECharts donut pie charts + tables showing star-level breakdowns

**Data flow**: Components call `fetch()` directly (no state management library). The `useStats.js` composable encapsulates stats API fetching. InputPage manages its own records state.

**Backend**: All routes are mounted under `/api/records` in `server/routes/records.js`. Stats aggregation happens in the `/api/records/stats` endpoint — the server parses JSON `stars` arrays from the DB and counts occurrences per star level (3/4/5/6). The response shape is `{ total, breakdown: [{ star, count, percentage }] }`.

**Database**: Single SQLite file (`server/data.db`), auto-created on first run. One table:
```sql
records (id INTEGER PK, stars TEXT, count INTEGER, created_at DATETIME)
```
`stars` is stored as a JSON array string. WAL mode enabled.

**Production**: Express serves `client/dist/` as static files, with SPA fallback for non-API routes. In dev, Vite proxies `/api` requests to Express.
