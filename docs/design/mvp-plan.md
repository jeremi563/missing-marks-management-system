# MVP Plan and Daily Task Breakdown

Goal of the MVP (**Phase 1 → `v0.1.0`**): one complete, secure, demoable missing-mark lifecycle on mock data, backend only (frontend follows).

> Owners are written as **Dev A–D** — assign real names at the kick-off. The owner split gives each person a *module* to understand deeply while keeping tasks small (one issue ≈ one working day). Adjust to skills and availability.

## 1. Module ownership (Phase 1)

| Dev | Home area | Why it works |
|---|---|---|
| **A** | Auth, security, state machine, appeals | Core security + workflow engine |
| **B** | Core middleware, users, report listing/detail, comments | Shared plumbing + read side |
| **C** | Academic structure, report submit/edit/withdraw, lecturer decisions, eligibility stub | Write side of reports |
| **D** | Audit, notifications, assignment, tests/Postman/docs | Cross-cutting + quality |

The **lead** (reviewer) handles Day 1 foundation tasks with others supporting, then reviews and merges.

## 2. Rules of the plan

- One in-progress task per person. Each task = one issue = one PR (`CONTRIBUTING.md`).
- **Day 1 lands the whole Phase 1 schema** so nobody fights over `schema.prisma` later.
- A task lists what it **depends on**; if a dependency isn't merged yet, start with the tests/docs part or take the next free task.
- Every task requires: validation (Zod), authorization + scope, tests, and docs updates where noted (see Definition of Done).
- If someone finishes early, they pick from the **buffer list** (§5) or review a teammate's PR.

## 3. Phase 0 — Setup (before Day 1)

| Step | Owner | Output |
|---|---|---|
| S-1 | Lead | Docs merged into `develop` (this folder) |
| S-2 | Lead | Branch protection + labels + issue templates + project board |
| S-3 | All | Install Node.js LTS, PostgreSQL, Git, VS Code, Postman; confirm you can clone and open a PR |
| S-4 | Lead | Kick-off meeting; decisions in `meeting-notes/README.md` confirmed |

## 4. Phase 1 daily plan

### Day 1 — Foundation (lead + support; sequential)
| ID | Task | Owner | Depends | Done when |
|---|---|---|---|---|
| T-001 | **Backend skeleton**: `package.json`, folder layout, Express app + `server.js`, env loading/validation, response helpers, error classes + central error handler, `/health`, request logging | Lead | S-1 | `npm run dev` serves `/health`; layout matches `docs/architecture/README.md` |
| T-002 | **Prisma schema (all Phase 1 models/enums)** + first migration + partial unique index for BR-01 + seed (mock registry, users, units, assessments, enrollments, assignments, settings) | Lead | T-001 | Clean DB → `migrate` + `seed` works; matches `database-design.md` |
| T-003 | ESLint + Prettier + Jest/Supertest config + test DB setup + npm scripts | Dev B | T-001 | `npm run lint` / `npm test` run (with one sample test) |
| T-004 | GitHub Actions CI (lint + test) and Postman collection skeleton + OpenAPI starter file | Dev D | T-001 | CI green on a PR; `docs/api/` has starter files |
| T-005 | Review schema vs `database-design.md`; write seed credentials table in `backend/README.md` | Dev A, C | T-002 | Review comments or approval; README updated |

### Day 2 — Core building blocks
| ID | Task | Owner | Depends | Done when |
|---|---|---|---|---|
| T-101 | Password policy validator + bcrypt hash/compare + JWT sign/verify + cookie helpers (+ unit tests) | A | T-001 | Utilities tested; no endpoints yet |
| T-102 | Zod `validate` middleware (body/params/query), pagination/sort helper, safe error mapping for Zod/Prisma errors | B | T-001 | Used by a sample route; unit tests |
| T-103 | **Audit service** `recordAudit(...)` (transaction-aware) + unit tests | D | T-002 | Service writes append-only rows; redacts sensitive fields |
| T-104 | **Notification service**: create in-app notification + email-provider interface with mock (logging) provider | C | T-002 | `notify(userId, event, ...)` works; mock logs email |

### Day 3 — Identity
| ID | Task | Owner | Depends | Done when |
|---|---|---|---|---|
| T-105 | Auth endpoints: register (mock registry), login, logout, `me`; lockout rules; audit events | A | T-101, T-102, T-103 | Integration tests: success, wrong password, lockout, inactive, duplicate |
| T-106 | `authenticate` + `authorize(roles)` middleware + scope helper functions (student/lecturer/COD/admin) | B | T-101 | Protected sample route tested per role |
| T-107 | Departments + units + assessments read endpoints; admin create | C | T-102, T-106 | Role/scope tests |
| T-108 | Enrollments + lecturer-assignments endpoints (admin create; scoped list) | D | T-102, T-106 | Tests incl. unique constraints |

### Day 4 — Users and report creation
| ID | Task | Owner | Depends | Done when |
|---|---|---|---|---|
| T-109 | Refresh-token rotation + revoke on logout; notification-email endpoint | A | T-105 | Rotation/revocation tests |
| T-110 | Admin users: list/provision/update/deactivate/reactivate (+ audit) | B | T-106, T-103 | Deactivated user cannot log in; history retained |
| T-111 | **Submit report**: validation, enrollment check, duplicate check (BR-01), reference generator, auto-assign / unassigned, status history, audit + notification in one transaction | C | T-106, T-103, T-104 | `POST /reports` meets contract; concurrency-safe reference |
| T-112 | Notifications endpoints: list, mark read/unread, read-all | D | T-104, T-106 | Owner-only tests |

### Day 5 — State machine and reading reports
| ID | Task | Owner | Depends | Done when |
|---|---|---|---|---|
| T-113 | **Report state machine module** (transition table from `workflows.md`) + exhaustive unit tests; helper `allowedActions(user, report)` | A | T-111 (or schema) | Every table row tested + invalid transitions rejected |
| T-114 | Report list (role-scoped, filters, search, pagination) + report detail with timeline | B | T-111 | IDOR tests: student/lecturer/COD scope |
| T-115 | Student edit + withdraw while Pending; lock rules | C | T-113 | BR-03/BR-04 tests; resubmission after withdrawal works |
| T-116 | Admin audit-log list with filters | D | T-103 | Admin only; pagination; filter tests |

### Day 6 — Lecturer side
| ID | Task | Owner | Depends | Done when |
|---|---|---|---|---|
| T-117 | `start-review` (assignee only) → UNDER_REVIEW, content locked, notify | A | T-113 | Tests incl. non-assignee 404/403 |
| T-118 | Comments: add, edit-until-locked, student reply rule; lock lecturer comments at COD start | B | T-114 | BR-07 tests |
| T-119 | Lecturer decision: approve/reject (reason mandatory), proposed mark ≤ maximum | C | T-113 | BR-05, BR-09 tests |
| T-120 | Assign/reassign (COD dept/admin) with history, reason, notifications | D | T-113, T-108 | BR-12 tests |

### Day 7 — COD side and appeals
| ID | Task | Owner | Depends | Done when |
|---|---|---|---|---|
| T-121 | COD `start-cod-review` + COD decision (approve → Closed; reject → appealable or Closed) | A | T-119 | Final decision locked at close (BR-08) |
| T-122 | Appeals: submit once (BR-06), appeal listing, appeal → COD decision via decisions endpoint | B | T-121 | Second appeal returns 409 |
| T-123 | Eligibility service **stub** + wiring into submit/detail (returns "not evaluated") + `accept-decision` endpoint | C | T-111, T-113 | Contract fields present; stub easy to swap |
| T-124 | Wire notification events for all transitions + audit events checklist review | D | T-117–T-122 | Each transition produces expected notification/audit |

### Day 8 — Integration and hardening
| ID | Task | Owner | Depends | Done when |
|---|---|---|---|---|
| T-125 | **Vertical-slice integration test**: full happy path + rejection/appeal path | A | T-124 | Passes in CI |
| T-126 | Security/IDOR/permission test suite across all Phase 1 endpoints | B | T-124 | Matrix of role × endpoint covered |
| T-127 | Postman collection for the whole flow + seed demo walkthrough in `backend/README.md` | D | T-124 | Flow runnable end-to-end |
| T-128 | Sync OpenAPI + `api-contracts.md` with implementation; fix drift | C | T-124 | No contract differences |

### Day 9 — Release
| ID | Task | Owner | Done when |
|---|---|---|---|
| T-129 | Bug fixes from review/testing; update docs/README | All | Zero known blockers |
| T-130 | Release checks and PR `develop → main`, tag `v0.1.0`, demo | Lead | Demo with mock data passes the MVP journey in `requirements.md` §7 |

## 5. Buffer list (pick when you finish early)
- Add missing unit tests for utilities.
- Improve error messages/validation details.
- Write user-guide draft for a finished flow.
- Review open PRs.
- Convert TODOs into issues.

## 6. Later phases (outline — detailed at the start of each)

| Phase | Main work | Tag |
|---|---|---|
| 2 Attendance | Password reset · classrooms · class sessions + link/QR · location check · records + history · discrepancies/corrections · session close review | `v0.2.0` |
| 3 Assessments & eligibility | Assessments · CAT attendance/confirm/verify · exam QR attendance · special-case evidence (Multer) · real eligibility engine · drafts | `v0.3.0` |
| 4 Admin & polish | Overdue job · settings endpoints · maintenance mode · archive/reopen · history deletion · PDF/Excel · dashboards statistics · 2FA (optional) · final OpenAPI/Postman · security review | `v0.4.0`, `v1.0.0` |
| Frontend | Starts after Phase 1 API is stable: React foundation, auth/role guards, student & staff screens | parallel from Phase 2 |

## 7. Risks to watch
- Schema conflicts → mitigated by Day 1 full-schema PR.
- Reviewer bottleneck → buddy review + small PRs.
- Scope creep → anything not in this plan needs an issue and a decision.
- Time → protect lifecycle + attendance + eligibility; exports/2FA slip first.
