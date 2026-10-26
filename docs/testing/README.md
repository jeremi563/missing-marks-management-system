# Testing Strategy

How we prove the system works and stays working. Practical test-writing rules are in `backend/tests/README.md`; acceptance scenarios and the release gate are in `tests/README.md`.

## 1. Goals
- Business rules (BR-xx) behave exactly as documented.
- Authorization is enforced by the backend for every protected operation.
- The main lifecycle works end-to-end on mock data.
- Regressions are caught automatically before code reaches `develop`.

## 2. Test levels

| Level | Tooling | Scope | Runs |
|---|---|---|---|
| **Unit** | Jest | Pure logic: state machine, eligibility maths, password policy, mark validation, working-day calculation, location distance, session validity | Every commit/PR (CI) |
| **API integration** | Jest + Supertest + test PostgreSQL | Routes → middleware → services → DB; envelopes, status codes, scope, side effects (history, audit, notification) | Every PR (CI) |
| **Security / permission** | Jest + Supertest | Role × endpoint matrix, IDOR attempts, cookie flags, lockout, file validation | Every PR (CI) |
| **Acceptance (manual/Postman)** | Postman + checklist | Whole journeys per phase | Before each release |
| **Frontend manual** | Browser, desktop + mobile viewport | Flows, validation states, responsive layouts, geolocation denied/unavailable, QR link on mobile | When the frontend exists |
| **Exploratory** | Human | Try to break it; unusual inputs | Before each release |

Most effort goes into unit + API integration tests; they are cheap and catch most defects.

## 3. What to test (traceability)

| Area | Must be covered |
|---|---|
| Auth | Password policy; bcrypt; register against registry; login failure generic message; lockout after 5 and reset on success; inactive user; token refresh/rotation; logout revokes |
| RBAC & scope | Each endpoint × each role; student sees only own; lecturer only assigned; COD only department; admin all; hidden records return `404` |
| Reports | Submit validation; enrollment; duplicate active (BR-01) incl. resubmission after withdrawal/closure (BR-02); edit/withdraw only Pending (BR-03); lock after review (BR-04); reference uniqueness under concurrency |
| State machine | Every valid transition; every invalid transition → `409`; transitions create status history + audit |
| Decisions | Rejection reason (BR-05); mark ≤ maximum (BR-09); COD required after lecturer approval; final decision locked (BR-08) |
| Appeals | One per case (BR-06); mandatory reason; allowed only after permitted rejection; goes to COD |
| Comments | Editable before COD review, immutable after, new comments still allowed (BR-07) |
| Assignment | Auto-assign by mapping; unassigned queue; reassign requires reason + history (BR-11, BR-12) |
| Notifications & audit | Row created for each defined event; owner-only read; audit has actor/time/entity/reason; no secrets stored |
| Attendance (P2) | Auth + enrollment + validity + duplicate + location order; closed/expired rejected; failed location ≠ absent; record + history consistent; scope; admin-only deletion |
| CAT / exam (P3) | Attendance, confirmation, verification separate; only Present satisfies; QR validated server-side; no student data in QR |
| Eligibility (P3) | 80% boundary (79.9 / 80.0 / 80.1), required CAT combinations, missing exam attendance, Special routing explanation |
| Uploads (P3) | Allowed types only, size limit, generated filenames, no path traversal, authorized download, no attendance-evidence uploads |
| Admin (P4) | Settings validation, maintenance mode, archive reason, exports scoped by role, overdue calculation |

## 4. Test data
- Mock data only: seeded dataset (`prisma/seed.js`) for manual/acceptance runs; factories for automated tests.
- Test database is separate from the dev database and is reset by the test setup.
- Time-dependent logic (deadlines, expiry, lockout) uses fake timers/injectable clock.

## 5. Definition of tested
A feature is tested when: unit tests cover its rules, an integration test covers each endpoint (happy, `401`, `403`, `404`, `422`, business-rule failure), side effects are asserted, and the PR description lists manual checks performed.

## 6. CI
GitHub Actions on every PR to `develop`/`main`: install → lint → test (against a PostgreSQL service container). A PR is not merged while CI is red.

## 7. Defect management
1. Report with the **Bug** issue template (steps, expected/actual, role, branch).
2. Label severity: **blocker** (breaks lifecycle/security), **major**, **minor**.
3. Fix in a `fix/<issue>-...` branch **with a regression test**.
4. Verify on `develop`, close the issue via the PR (`Closes #n`).
5. Release gate: no open blocker/major bugs.

## 8. Test case record (manual)
Use this table format in `tests/acceptance/` files:

| ID | Requirement/BR | Preconditions | Steps | Expected | Result | Tester/date | Defect |
|---|---|---|---|---|---|---|---|

## 9. Release checklist
See "Release gate" in `tests/README.md`.

## 10. Roles
- **Developers:** write unit + integration tests with each task.
- **Quality owner (Dev D):** maintains the security matrix, Postman collection, acceptance scripts and release checklist.
- **Lead:** enforces "no tests, no merge" in review.
