# Backend

Express + Prisma + PostgreSQL REST API for the Missing Marks Management System.
Design lives in `../docs` — read `docs/architecture/README.md`, `docs/design/workflows.md`, `docs/design/database-design.md` and `docs/design/api-contracts.md` before your first task.

> **Status:** Phase 1 (MVP) — skeleton is created in tasks T-001/T-002 (`docs/design/mvp-plan.md`). Sections marked *(planned)* become true once those tasks are merged; the owner of the task updates this README.

## 1. Prerequisites

| Tool | Version |
|---|---|
| Node.js | current LTS (≥ 20) |
| npm | bundled with Node |
| PostgreSQL | 14+ running locally |
| Git | any recent |
| Postman (or similar) | for manual API checks |

## 2. First-time setup *(planned)*

```bash
cd backend
npm install
cp ../.env.example .env        # then edit values (see §3)
createdb missing_marks_dev     # or create the DB with pgAdmin/psql
createdb missing_marks_test    # separate database for automated tests
npx prisma migrate dev         # apply migrations
npx prisma db seed             # load MOCK data
npm run dev                    # start API on http://localhost:4000
```

Check it works: `GET http://localhost:4000/health` → `{ "status": "ok" }`.

## 3. Environment variables

Copy `../.env.example` to `backend/.env`. **Never commit `.env`.** The app validates required variables at startup and refuses to start with a clear message if one is missing.

| Variable | Purpose | Example / default |
|---|---|---|
| `NODE_ENV` | Environment | `development` |
| `PORT` | API port | `4000` |
| `DATABASE_URL` | Dev database | `postgresql://USER:PASSWORD@localhost:5432/missing_marks_dev` |
| `TEST_DATABASE_URL` | Test database | `postgresql://USER:PASSWORD@localhost:5432/missing_marks_test` |
| `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET` | JWT signing (long random strings, different) | placeholder only |
| `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL` | Token lifetimes | `15m` / `7d` |
| `FRONTEND_URL` | CORS allow-list origin | `http://localhost:5173` |
| `API_BASE_URL` | Public API URL (links, QR) | `http://localhost:4000` |
| `COOKIE_SECURE` / `COOKIE_SAME_SITE` | Cookie flags | `false` (dev) / `lax` |
| `EMAIL_PROVIDER` | `mock` logs emails to console | `mock` |
| `FILE_STORAGE_PATH` | Evidence folder (Phase 3) | `./storage` |
| `MAX_SPECIAL_CASE_UPLOAD_BYTES` | Upload limit (Phase 3) | `5242880` |
| `ATTENDANCE_THRESHOLD_PERCENT` | Default 80 | `80` |
| `DEFAULT_LECTURER_DEADLINE_WORKING_DAYS` / `DEFAULT_COD_DEADLINE_WORKING_DAYS` | Defaults 3 / 5 | |
| `LOGIN_MAX_FAILED_ATTEMPTS` / `LOGIN_LOCKOUT_MINUTES` | Defaults 5 / 30 | |
| `DEFAULT_ATTENDANCE_SESSION_DURATION` | Minutes (Phase 2) | |
| `DEFAULT_DRAFT_RETENTION_PERIOD` | Days (Phase 3) | |
| `MAINTENANCE_MODE` | Phase 4 | `false` |

When you add a variable: update `../.env.example` **and** this table in the same PR.

## 4. npm scripts *(planned)*

| Script | Purpose |
|---|---|
| `npm run dev` | Start with auto-reload |
| `npm start` | Production-style start |
| `npm test` | Run all tests (Jest) |
| `npm run test:unit` / `test:integration` | Subsets |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run format` | Prettier |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:seed` | Load mock data |
| `npm run db:reset` | Drop, migrate, seed (dev only) |

## 5. Project structure
See `docs/architecture/README.md` §3. In short: `src/modules/<module>/` contains routes → controller → service → Zod schema; shared helpers in `src/common/`; Prisma in `prisma/`.

## 6. Mock data and test accounts *(planned — T-002/T-005 fills this table)*

All data is fake. Development passwords only.

| Role | Login identifier | Notes |
|---|---|---|
| Admin | _(from seed)_ | |
| COD | _(from seed)_ | Computer Science department |
| Lecturer 1 / 2 | _(from seed)_ | Lecturer 2 teaches the unit **without** auto-assignment mapping |
| Students 1–4 | _(from seed)_ | Registered in mock registry; enrollments in seeded units |

## 7. How to add an endpoint (checklist)

1. Read the contract in `docs/design/api-contracts.md`; if it is missing or wrong, fix the doc first.
2. Add Zod schema (`<module>.schema.js`) for body/params/query.
3. Add service function(s): business rules, **scope inside the query**, transaction where needed, audit + notification calls.
4. Add controller (thin) and route with `authenticate`, `authorize(...)`, `validate(...)`.
5. Register the router in `src/routes/index.js` (one line).
6. Write tests: happy path, validation failure, permission/scope failure, business-rule failure.
7. Update OpenAPI/Postman + docs; run `npm run lint && npm test`.

## 8. Conventions
- JSON properties camelCase; DB snake_case (Prisma `@map`).
- Always return the standard envelope; use the error classes in `common/errors`.
- No business rules in routes/controllers; no Prisma outside services.
- Never log secrets or precise location; no `console.log` leftovers (use the logger helper once it exists).
- Migrations: one logical change each; never edit merged migrations.
- Never commit `.env`, uploaded files, `node_modules`.

## 9. Troubleshooting

| Problem | Try |
|---|---|
| `ECONNREFUSED` to Postgres | Is the service running? Check `DATABASE_URL` host/port/user |
| Prisma "schema drift" | `npx prisma migrate reset` (dev DB only — wipes data) |
| Port already in use | Change `PORT` or stop the other process |
| Tests fail on a fresh clone | Did you create the **test** database and set `TEST_DATABASE_URL`? |
| App exits at startup with "missing env" | Compare `.env` with `.env.example` |

See the root `CONTRIBUTING.md` for the branch/PR workflow and `docs/testing/README.md` for the test strategy.
