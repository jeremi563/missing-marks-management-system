# Backend Tests

Automated tests for the API: **Jest** (runner/assertions) + **Supertest** (HTTP against the Express app). Strategy and test-case catalogue: `docs/testing/README.md`.

## Layout *(created in task T-003)*

```
backend/tests/
├── unit/                    # pure logic, no DB, no HTTP
│   ├── common/              # pagination, working-day calc, reference format
│   ├── auth/                # password policy, token helpers
│   └── reports/             # state machine, mark validation, appeal rules
├── integration/             # HTTP + real test database
│   ├── auth.test.js
│   ├── reports.test.js
│   ├── appeals.test.js
│   ├── notifications.test.js
│   └── security/            # role × endpoint matrix, IDOR checks
├── helpers/
│   ├── db.js                # reset/seed test database
│   ├── factories.js         # create users, units, reports for tests
│   └── auth.js              # log in as a role → returns a Supertest agent with cookies
└── README.md
```

File naming: `<thing>.test.js`. Mirror the `src/modules/` structure where it helps.

## Running

```bash
cd backend
npm test                    # everything
npm run test:unit
npm run test:integration
npx jest tests/integration/reports.test.js   # one file
npx jest -t "duplicate"                      # by test name
```

## Test database

- Integration tests use a **separate** PostgreSQL database (`TEST_DATABASE_URL`) — never the dev database.
- The test setup applies migrations to the test DB, and each test file starts from a known state (truncate + minimal seed, or factories). Tests must not depend on execution order or on each other's data.
- Never run tests against a database containing anything you care about.

## Writing a good test

1. **Name by behaviour:** `it('rejects a second appeal for the same report (BR-06)')`.
2. **Arrange / Act / Assert**, one behaviour per test.
3. Prefer factories over giant fixtures; keep data minimal and obviously fake.
4. For every endpoint cover at least:
   - ✅ happy path
   - ❌ unauthenticated → `401`
   - ❌ wrong role → `403`
   - ❌ wrong owner/department/assignment → `404`
   - ❌ invalid input → `422` with `VALIDATION_ERROR`
   - ❌ the key business-rule violation → the documented error code
5. Assert on the **standard envelope** (`success`, `error.code`) and on side effects: status history row, audit row, notification row.
6. Reference business rules in test names (`BR-01`, `BR-06`) so coverage is traceable.
7. Don't mock Prisma in integration tests; do mock the clock when testing deadlines/expiry (fake timers).
8. No `.only`/`.skip` committed; flaky tests are fixed or removed, not ignored.

## Must-have suites by phase

| Phase | Suites |
|---|---|
| 1 | Password policy · lockout · register/login/logout/refresh · RBAC middleware · report submit/duplicate/withdraw/edit-lock · state machine (every transition + every illegal one) · lecturer decision (reason, mark max) · COD decision · one-appeal rule · comment immutability · assignment/reassignment · notification read/unread · audit rows · IDOR matrix |
| 2 | Session validity · duplicate attendance (incl. concurrent requests) · location boundary maths · failed location ≠ absent · record + history consistency · history scope per role · discrepancy workflow · admin-only history delete |
| 3 | CAT confirm/verify separation · exam QR validation · eligibility engine (80% threshold edges, required CATs) · upload type/size/path safety |
| 4 | Overdue calculations · exports scope · maintenance mode · archive access reason |

## Coverage
Informational target ≥ 70% on `src/modules/**/**.service.js` (decision D-16). Don't chase numbers; cover rules and permissions first.
