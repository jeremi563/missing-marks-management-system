# API Contracts

The shared agreement between all backend (and later frontend) developers. **Change a contract → update this file in the same PR → notify affected teammates.** The machine-readable version lives in `docs/api/` (OpenAPI) and is kept in sync from Phase 1.

Base path: `/api/v1` · Format: JSON · Auth: JWT in HttpOnly cookies.

Phase tags: **P1** = MVP (fully specified below), **P2/P3/P4** = listed for planning; request/response detail is added by the module owner at the start of that phase.

---

## 1. Conventions

### 1.1 Success envelope
```json
{ "success": true, "message": "Operation completed successfully", "data": {} }
```
Lists add a `meta` object:
```json
{
  "success": true,
  "message": "Reports retrieved",
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 }
}
```

### 1.2 Error envelope
```json
{
  "success": false,
  "message": "The request could not be completed",
  "error": { "code": "VALIDATION_ERROR", "details": [ { "field": "description", "message": "Required" } ] }
}
```
Never include stack traces, SQL, file paths, tokens or other users' data.

### 1.3 Status codes
`200` OK · `201` Created · `204` No Content · `400` malformed request · `401` not authenticated · `403` authenticated but not permitted · `404` not found *(also used to hide records the caller may not know exist)* · `409` conflict / invalid state transition / duplicate · `422` validation or business-rule failure · `429` rate limit · `500` unexpected · `503` maintenance.

> **Rule of thumb:** malformed JSON → 400; schema validation errors → 422 `VALIDATION_ERROR`; business rule broken → 422 or 409 as listed per endpoint; record outside your scope → 404.

### 1.4 Error codes

| Code | HTTP | Meaning |
|---|:--:|---|
| `VALIDATION_ERROR` | 422 | Zod validation failed (`details` lists fields) |
| `UNAUTHENTICATED` | 401 | Missing/invalid/expired access token |
| `INVALID_CREDENTIALS` | 401 | Wrong identifier or password (generic on purpose) |
| `ACCOUNT_LOCKED` | 403 | Too many failed logins; includes `retryAfterMinutes` |
| `ACCOUNT_INACTIVE` | 403 | Account deactivated |
| `FORBIDDEN` | 403 | Role not allowed |
| `NOT_FOUND` | 404 | Not found or outside caller's scope |
| `DUPLICATE_ACTIVE_REPORT` | 409 | BR-01 |
| `INVALID_STATE_TRANSITION` | 409 | Action not allowed in current status |
| `REPORT_LOCKED` | 409 | Edit attempted after review started (BR-04) |
| `APPEAL_ALREADY_USED` | 409 | BR-06 |
| `NOT_ENROLLED` | 422 | Student not enrolled in unit |
| `NOTIFICATION_EMAIL_REQUIRED` | 422 | BR-14 |
| `REASON_REQUIRED` | 422 | Rejection / reassignment / reopen without reason |
| `MARK_EXCEEDS_MAXIMUM` | 422 | BR-09 |
| `EMAIL_ALREADY_REGISTERED` / `REGISTRATION_NOT_FOUND` | 409 / 422 | Registration checks |
| `RATE_LIMITED` | 429 | Too many requests |
| `MAINTENANCE_MODE` | 503 | P4 |
| `INTERNAL_ERROR` | 500 | Generic |

Phase 2+ will add: `SESSION_CLOSED`, `SESSION_EXPIRED`, `ALREADY_RECORDED`, `LOCATION_CHECK_FAILED`, `INVALID_QR`, `FILE_TYPE_NOT_ALLOWED`, `FILE_TOO_LARGE`.

### 1.5 Pagination, sorting, filtering
Query: `page` (default 1), `limit` (default 20, max 100), `sort` (e.g. `submittedAt`), `order` (`asc|desc`, default `desc`), plus resource filters. Filtering/pagination happen in the database. Invalid values → 422.

### 1.6 Naming
JSON properties are **camelCase** (`submittedAt`, `assignedLecturer`). Database columns are snake_case (Prisma maps). Dates are ISO-8601 UTC strings. IDs are UUID strings; reports also expose `reference`.

### 1.7 Authentication cookies *(proposal — confirm P-02)*

| Cookie | Content | Lifetime | Attributes |
|---|---|---|---|
| `access_token` | JWT (userId, role) | 15 min | HttpOnly, SameSite=Lax, Secure in HTTPS, Path=/ |
| `refresh_token` | Opaque/JWT refresh token (hash stored server-side, rotated on use) | 7 days | HttpOnly, SameSite=Lax, Secure in HTTPS, Path=/api/v1/auth |

CSRF approach: SameSite=Lax cookies + strict CORS allow-list (`FRONTEND_URL`, credentials on) + all mutating endpoints accept only `application/json`. Revisit if frontend and API end up on different sites.
JWT payload contains only `sub` (user id) and `role` — the server always re-reads user state (active, lock) where decisions depend on it.

### 1.8 Authorization levels used below
`Public` · `Auth` (any logged-in user) · or role list. **"scoped"** means the query itself is restricted: Student → own; Lecturer → assigned (or own units); COD → own department; Admin → all. Out-of-scope records return `404`.

---

## 2. Phase 1 endpoints (MVP)

### 2.1 Auth

| Method & path | Access | Purpose |
|---|---|---|
| `POST /auth/register` | Public | Student self-registration |
| `POST /auth/login` | Public | Log in, set cookies |
| `POST /auth/logout` | Auth | Clear cookies, revoke refresh token |
| `POST /auth/refresh` | Refresh cookie | Rotate tokens |
| `GET /auth/me` | Auth | Current user profile |
| `PATCH /auth/me/notification-email` | Student | Set notification email (BR-14) |

**`POST /auth/register`** — body: `registrationNumber`, `email`, `password`, `confirmPassword`. Checks: number exists in mock registry and unused; email unique; password policy (BR-40). `201` → `{ user: { id, role, fullName, registrationNumber, email } }` (user is **not** auto-logged in unless team decides otherwise). Errors: `REGISTRATION_NOT_FOUND` 422, `EMAIL_ALREADY_REGISTERED` 409, `VALIDATION_ERROR` 422.

**`POST /auth/login`** — body: `identifier` (registration number, staff number or email), `password`. `200` → `{ user: { id, role, fullName, departmentId } }` + cookies. Errors: `INVALID_CREDENTIALS` 401, `ACCOUNT_LOCKED` 403, `ACCOUNT_INACTIVE` 403. Audit: login success / failure / lockout.

**`GET /auth/me`** → `{ id, role, fullName, email, notificationEmail, registrationNumber?, staffNumber?, department?: { id, name } }`.

### 2.2 Academic structure (read for all authenticated roles as scoped; create = Admin)

| Method & path | Access | Purpose |
|---|---|---|
| `GET /departments` · `POST /departments` | Auth · Admin | List / create |
| `GET /units` · `POST /units` | Auth (scoped) · Admin | List (filter `departmentId`, `q`) / create |
| `GET /units/:id` | Auth (scoped) | Detail incl. assessments |
| `GET /enrollments` · `POST /enrollments` | Student (own) / Admin · Admin | Student sees own enrollments; admin can filter by `studentId`, `unitId` |
| `GET /lecturer-assignments` · `POST /lecturer-assignments` | Lecturer (own) / COD (dept) / Admin · Admin | |
| `GET /units/:id/assessments` | Auth (scoped) | Assessments of a unit (for report form) |

### 2.3 Users (Admin)

| Method & path | Access | Purpose |
|---|---|---|
| `GET /users` | Admin | Paginated; filters `role`, `departmentId`, `isActive`, `q` |
| `POST /users` | Admin | Provision lecturer/COD/admin account (temporary password policy to be decided) |
| `PATCH /users/:id` | Admin | Update profile fields, role, department |
| `POST /users/:id/deactivate` · `POST /users/:id/reactivate` | Admin | Block/allow login; audited; records retained |

### 2.4 Reports

| Method & path | Access | Purpose |
|---|---|---|
| `POST /reports` | Student | Submit report (T1) |
| `GET /reports` | Auth (scoped) | Paginated list with filters |
| `GET /reports/:id` | Auth (scoped) | Detail: report, status history, comments, decisions, appeal, assignment |
| `PATCH /reports/:id` | Student (owner) | Edit while Pending (T2) |
| `POST /reports/:id/withdraw` | Student (owner) | Withdraw while Pending (T3) |
| `POST /reports/:id/start-review` | Lecturer (assignee) | T4 |
| `POST /reports/:id/comments` | Lecturer / COD / Student(owner)* | Add comment |
| `PATCH /reports/:id/comments/:commentId` | Author | Edit own comment if not locked (BR-07) |
| `POST /reports/:id/decisions` | Lecturer (assignee) / COD | Approve or reject (T5, T6, T10, T11) |
| `POST /reports/:id/start-cod-review` | COD (dept) | T7 / T9 |
| `POST /reports/:id/assign` | COD (dept) / Admin | Assign or reassign lecturer (BR-12) |
| `POST /reports/:id/accept-decision` | Student (owner) | Accept rejection → Closed (T12) |
| `GET /reports/:id/history` | Auth (scoped) | Status timeline only |

\* Whether students may comment (e.g. replying to a request for information) is open — default for MVP: **students can reply when a lecturer posted `REQUEST_FOR_INFORMATION`**; confirm in meeting.

**`POST /reports`** — body:
```json
{
  "unitId": "uuid",
  "assessmentId": "uuid | null",
  "academicYear": "2025/2026",
  "semester": 1,
  "yearUnitTaken": 2025,
  "description": "string, 10–2000 chars"
}
```
`201` → `{ id, reference, status: "PENDING", assignedLecturer: { id, fullName } | null, submittedAt, lecturerDueAt, caseClassification: null }`.
Errors: `NOT_ENROLLED` 422, `DUPLICATE_ACTIVE_REPORT` 409, `NOTIFICATION_EMAIL_REQUIRED` 422, `VALIDATION_ERROR` 422.

**`GET /reports`** — filters: `status`, `unitId`, `departmentId`, `assignedLecturerId`, `studentId`*, `q` (reference / registration number / student name), `from`, `to`, `classification`, `overdue` (bool), `unassigned` (bool, COD/Admin), `appealUsed`; plus pagination/sort. *Only meaningful for staff; students always limited to own.* List item: `{ id, reference, status, unit: {id,code,name}, student: {id, registrationNumber, fullName}*, assignedLecturer, submittedAt, isOverdue, caseClassification, appealUsed }` (*student block omitted for the student's own list).

**`GET /reports/:id`** → report fields + `statusHistory[]` + `comments[]` + `decisions[]` + `appeal | null` + `eligibility` (`{classification, explanation[]}` or `null`) + `allowedActions[]` (computed for the caller, e.g. `["withdraw","edit"]`, so the frontend needn't duplicate rules).

**`POST /reports/:id/decisions`** — body: `{ "decision": "APPROVE|REJECT", "reason": "string (required when REJECT)", "proposedMark": 0, "originalMark": 0 }` (marks optional). The caller's role decides the level (lecturer vs COD). Errors: `REASON_REQUIRED`, `MARK_EXCEEDS_MAXIMUM`, `INVALID_STATE_TRANSITION`, `FORBIDDEN`/`NOT_FOUND`.

**`POST /reports/:id/assign`** — body: `{ "lecturerId": "uuid", "reason": "string required" }`. Lecturer must be assigned to the unit (or in same department — decision P-05); COD limited to own department.

### 2.4.1 Appeals

| Method & path | Access | Purpose |
|---|---|---|
| `POST /reports/:id/appeal` | Student (owner) | T8 — body `{ "reason": "required", "additionalInfo": "optional" }` |
| `GET /appeals` | COD (dept) / Admin / Student (own) | Paginated |
| `GET /appeals/:id` | scoped | Appeal + attached report context |

The appeal decision uses `POST /reports/:id/decisions` by the COD (single decision path) — **not** a separate endpoint — to keep one state machine. *(Note: the design document proposes `POST /appeals/:id/decision`; we deliberately merge it. Confirm in P-10.)*

### 2.5 Notifications

| Method & path | Access | Purpose |
|---|---|---|
| `GET /notifications` | Auth | Own notifications; filters `unread`, pagination |
| `PATCH /notifications/:id/read` | Auth (owner) | Mark read (body `{ "read": true|false }`) |
| `PATCH /notifications/read-all` | Auth | Mark all read |

Item: `{ id, eventType, title, message, reportId?, readAt, createdAt }`.

### 2.6 Audit (Admin)

| Method & path | Access | Purpose |
|---|---|---|
| `GET /admin/audit-logs` | Admin | Paginated; filters `actorId`, `action`, `entityType`, `entityId`, `from`, `to` |

Item: `{ id, actor: {id, fullName}|null, action, entityType, entityId, reason, previousValues, newValues, createdAt }`. COD department-scoped audit view arrives in P4.

### 2.7 Health
`GET /health` (Public, **outside** `/api/v1` or inside — decide once): `{ status: "ok", time }`. No sensitive info.

---

## 3. Later-phase endpoints (planning list)

Request/response detail to be added by the owner at the start of each phase.

**Phase 2 — Attendance & auth extras** (access in brackets)
- `POST /auth/password-reset/request`, `POST /auth/password-reset/confirm` [Public]
- `POST/GET /classrooms` [Lecturer/Admin]
- `POST /attendance/sessions` [Lecturer], `GET /attendance/sessions`, `GET /attendance/sessions/:id`, `POST /attendance/sessions/:id/close`
- `POST /attendance/sessions/:id/attempt` [Student] — body: `{ token, latitude, longitude, accuracy }`
- `GET /attendance/history` [scoped], `GET /attendance/records/:id`, `POST /attendance/records/:id/corrections` [Lecturer]
- `POST /attendance/discrepancies` [Student], `GET /attendance/discrepancies`, `POST /attendance/discrepancies/:id/resolve` [Lecturer], `POST /attendance/discrepancies/:id/escalate`, COD decision
- `POST /admin/attendance-history/:id/delete` [Admin, P4 acceptable]

**Phase 3 — Assessments, special cases, drafts**
- `POST/GET /assessments`, `GET /assessments/:id`, `POST /assessments/:id/cat-sessions`
- `POST /cat-submissions/:id/confirm` [Student], `POST /cat-submissions/:id/verify` [Lecturer], `GET /assessments/:id/cat-submissions`
- `POST /assessments/:id/exam-qr-references`, `POST /examination-attendance/scan` [Student], `GET /assessments/:id/examination-attendance`
- `POST /reports/:id/special-case`, `POST|GET /special-cases/:id/evidence`, `DELETE /special-cases/:id/evidence/:evidenceId`
- `POST /reports/drafts`, `PATCH /reports/drafts/:id`, `GET /reports/drafts`

**Phase 4 — Admin & reporting**
- `GET|PATCH /admin/settings`, `POST /admin/maintenance-mode`
- `GET /reports/exports/pdf`, `GET /reports/exports/excel`
- `GET /admin/archived-records`, `POST /admin/archived-records/:id/access` (reason required)
- `POST /reports/:id/reopen` [Admin, reason required]
- `POST /auth/2fa/verify` [Admin]
- Dashboard statistics endpoints (`GET /dashboard/student|lecturer|cod|admin`)

---

## 4. Permission rules per resource (summary for reviewers)

| Resource | Student | Lecturer | COD | Admin |
|---|---|---|---|---|
| Report read | own | `assigned_lecturer_id = me` | `department_id = my dept` | all |
| Report write | own, Pending only | assigned, workflow actions | dept, workflow actions | assign/reopen |
| Notification | own | own | own | own |
| Audit log | – | – | – (P4: dept) | all |
| Users | self (`/auth/me`) | self | self | all |

Every service method receives the authenticated user and applies the scope in the **query itself** (e.g. `where: { id, studentId: user.id }`) — never fetch-then-check only in the controller.

---

## 5. Contract change process

1. Open/comment on the issue describing the change.
2. Update this file (and OpenAPI) in the same PR as the code.
3. Mention affected teammates in the PR.
4. Breaking changes to an already-merged endpoint need lead approval and a note in the weekly meeting notes.
