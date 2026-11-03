# API Contract and Conventions

## 1. Purpose and status

This document defines the initial REST API conventions and proposed role-based route layout. The routes below are starting points for team discussion; they are not final until the team confirms request bodies, response fields, permissions and workflow rules.

The shared Express application now implements the health endpoint and the initial authentication contract below. Role-module routes remain proposals until their owners finalize resource payloads and permissions.

## 2. Base path

All backend endpoints should be versioned under:

```text
/api/v1
```

Role-based route prefixes:

```text
/api/v1/auth
/api/v1/student
/api/v1/lecturer
/api/v1/cod
/api/v1/admin
```

## 3. HTTP conventions

Use HTTP methods consistently:

- `GET` — retrieve a resource or list.
- `POST` — create a resource or trigger a defined action.
- `PATCH` — partially update a resource.
- `PUT` — replace a resource only where full replacement is intended.
- `DELETE` — delete only where deletion is allowed by the agreed retention policy.

Use plural resource names for collections, for example `/reports`. Use `:id` for a resource identifier.

## 4. Initial route catalogue

### Authentication

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/auth/login` | Authenticate a user. |
| POST | `/api/v1/auth/logout` | End the authenticated session/token where supported. |
| GET | `/api/v1/auth/me` | Return the authenticated user's permitted profile summary. |

### Implemented authentication baseline

- `POST /api/v1/auth/login` accepts `{ "email": "...", "password": "..." }` and sets a 15-minute JWT in the `access_token` HttpOnly, SameSite=Strict cookie. The cookie is Secure in production.
- `POST /api/v1/auth/logout` clears the cookie. This is stateless logout; an already copied token remains valid until expiry.
- `GET /api/v1/auth/me` returns the authenticated user's ID, email, display name and database roles.
- Protected middleware also accepts a Bearer token for non-browser clients. Roles are reloaded from PostgreSQL on each protected request, so role changes take effect immediately.
- Passwords are stored as bcrypt hashes. Set `JWT_SECRET` to a random secret of at least 32 characters. Never put the secret in source control.
- Account registration, password reset, lockout policy, refresh tokens, and session revocation are not yet implemented; agree their requirements before adding them.

### Student

All routes below are mounted under `/api/v1`. Each requires a valid authenticated user with the `student` role. Ownership is derived from that user; clients must not send a student profile ID. Report and notification lookups are scoped to the authenticated owner, and records outside that scope return `404`.

| Method | Path | Request | Success |
|---|---|---|---|
| GET | `/api/v1/student/profile` | No body. | `200`, own profile. |
| GET | `/api/v1/student/reports` | Optional `page` and `limit`. | `200`, own reports and pagination. |
| POST | `/api/v1/student/reports` | Required `courseUnitId`, `academicPeriodId`, `assessmentComponent`, `description`; optional `assessmentId`. | `201`, submitted report. |
| GET | `/api/v1/student/reports/:reportId` | UUID `reportId`; no body. | `200`, own report with status timeline. |
| GET | `/api/v1/student/reports/:reportId/comments` | UUID `reportId`; no body. | `200`, comments visible to the student. |
| POST | `/api/v1/student/reports/:reportId/comments` | UUID `reportId`; `{ "body": "..." }`. | `201`, clarification comment. |
| PATCH | `/api/v1/student/reports/:reportId` | UUID `reportId`; at least one of `assessmentId`, `assessmentComponent`, `description`. | `200`, updated report. |
| POST | `/api/v1/student/reports/:reportId/withdraw` | UUID `reportId`; no body. | `200`, report with `Withdrawn` status. |
| POST | `/api/v1/student/reports/:reportId/appeals` | UUID `reportId`; `{ "reason": "...", "comments": "..." }`, where `comments` is optional. | `201`, submitted appeal. |
| POST | `/api/v1/student/reports/:reportId/appeal` | Same as plural `/appeals`; compatibility alias. | `201`, submitted appeal. |
| GET | `/api/v1/student/attendance` | Optional `page` and `limit`. | `200`, own attendance history and pagination. |
| GET | `/api/v1/student/notifications` | Optional `page` and `limit`. | `200`, own notifications, unread count, and pagination. |
| PATCH | `/api/v1/student/notifications/:notificationId/read` | UUID `notificationId`; no body. | `200`, own notification with `readAt` set. |

### Student request and behavior details

- `page` is an integer of at least `1`, default `1`. `limit` is an integer from `1` to `100`, default `10`. Unknown query fields are rejected. These parameters apply to report lists, attendance, and notifications.
- Report submission trims `assessmentComponent` (1-100 characters) and `description` (1-5,000 characters). It verifies the student is enrolled in the selected unit and academic period and, if supplied, that the assessment belongs to the unit. It creates the report as `Submitted` and records initial status history and an audit event in one transaction. Duplicate report submissions are currently allowed.
- Report editing accepts optional `assessmentId` (UUID), `assessmentComponent` (1-100 characters), and `description` (1-5,000 characters); at least one field is required and unknown fields are rejected. A replacement assessment must belong to the report's existing course unit. Unit and period cannot be changed through this endpoint. Editing is allowed only in `Submitted`; the update is conditional on the report still being in that state.
- Withdrawal has no request body and is allowed only while the report is `Submitted`. The status change is conditional on the current state and is recorded in status history.
- Appeals require a non-empty `reason` (maximum 5,000 characters) and allow optional `comments` (maximum 2,000 characters). Only a report with status `REJECTED` is eligible, and at most one appeal may be created per report. An owned report row is locked during the duplicate check. No deadline is enforced because one has not been configured; appeal review and decision authority are not implemented by this student submission endpoint.
- Student comment bodies are trimmed and must contain 1-2,000 characters. Students can post clarification comments only to their own report; the API assigns authorship from the authenticated identity. The read endpoint returns comments marked `isStudentVisible: true` plus comments authored by the requesting student. Lecturer comment creation currently has no visibility toggle, so lecturer-authored comments will remain hidden until that integration is coordinated and implemented.
- Attendance reads the student's `AttendanceHistory` snapshots, newest sign-in first, including available correction history. Notifications are queried by authenticated user ID, newest first, and include `readAt`, linked report summary when available, and an unread count. Mark-as-read is idempotent and owner-scoped; another user's notification returns `404`.

Validation failures return `400`; missing profile or out-of-scope records return `404`; invalid enrollment/assessment relations return `422`; and state conflicts such as editing or withdrawing a non-`Submitted` report, appealing an ineligible report, or submitting a duplicate appeal return `409`. Successful list responses use the standard `{ success, message, count, data, pagination }` envelope; notification lists also include `unreadCount`. Successful writes and reads use `{ success, message, data }` with `200` or `201` as shown above.

Examples:

```http
POST /api/v1/student/reports
Content-Type: application/json

{"courseUnitId":"<uuid>","academicPeriodId":"<uuid>","assessmentId":"<uuid>","assessmentComponent":"CAT 1","description":"My CAT 1 mark is missing."}
```

```http
PATCH /api/v1/student/reports/{reportId}
Content-Type: application/json

{"assessmentComponent":"CAT 2","description":"My CAT 2 mark is missing."}
```

```http
POST /api/v1/student/reports/{reportId}/comments
Content-Type: application/json

{"body":"I submitted the assessment on the scheduled date."}
```

```http
POST /api/v1/student/reports/{reportId}/appeals
Content-Type: application/json

{"reason":"The rejection did not consider my submitted evidence.","comments":"Please review the record."}
```

```http
PATCH /api/v1/student/notifications/{notificationId}/read
```

### Lecturer

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/lecturer/reports` | List reports assigned to the lecturer. |
| GET | `/api/v1/lecturer/reports/:id` | View an assigned report. |
| POST | `/api/v1/lecturer/reports/:id/comments` | Add an investigation comment. |
| POST | `/api/v1/lecturer/reports/:id/approve` | Record an approval where authorised. |
| POST | `/api/v1/lecturer/reports/:id/reject` | Record a rejection with a reason. |
| POST | `/api/v1/lecturer/attendance-sessions` | Create an attendance session. |
| GET | `/api/v1/lecturer/attendance-sessions` | List sessions within lecturer's scope. |

### COD / Academic Officer

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/cod/reports` | List departmental reports. |
| POST | `/api/v1/cod/reports/:id/assign` | Assign or reassign a report where permitted. |
| POST | `/api/v1/cod/reports/:id/approve` | Record a departmental decision where authorised. |
| POST | `/api/v1/cod/reports/:id/reject` | Record a departmental rejection with a reason. |
| GET | `/api/v1/cod/appeals` | List appeals within the authorised scope. |
| GET | `/api/v1/cod/reports/overdue` | List overdue reports. |

### Administrator

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/admin/users` | List users within administrative permissions. |
| POST | `/api/v1/admin/users` | Create a user account. |
| PATCH | `/api/v1/admin/users/:id` | Update permitted account fields. |
| GET | `/api/v1/admin/departments` | List departments. |
| POST | `/api/v1/admin/departments` | Create a department. |
| GET | `/api/v1/admin/reports` | View system-wide report summaries within permissions. |
| GET | `/api/v1/admin/audit-logs` | View permitted audit records. |
| PATCH | `/api/v1/admin/settings` | Update permitted system settings. |

Additional routes for attendance, CAT, examination attendance, notifications, special cases and exports should be added when the team confirms their requirements.

## 5. Authentication and authorisation

- Protected routes must require a valid authenticated identity.
- Role permissions must be checked on the backend.
- Check record ownership and organisational scope, not just the user's role.
- A student must not access another student's report by changing an ID.
- A lecturer must not access reports outside their authorised assignment/scope.
- COD / Academic Officer access must be limited to the agreed department or academic scope.
- Administrative permissions must not be interpreted as permission to change official marks.
- Return an appropriate unauthorised or forbidden response without leaking private record details.

The current token strategy is the implementation baseline described above. Role names remain database records rather than a Prisma enum; the initial seed uses `student`, `lecturer`, `cod`, and `administrator`.

## 6. Response format

Successful response example:

```json
{
  "success": true,
  "message": "Report submitted successfully",
  "data": {
    "id": "resource-uuid"
  }
}
```

Error response example:

```json
{
  "success": false,
  "message": "Report not found"
}
```

The team should agree whether validation details, pagination metadata and error codes will be represented in additional standard fields. Keep the response structure consistent across modules.

## 7. Status codes

Use status codes consistently:

- `200 OK` — successful read or update.
- `201 Created` — resource created.
- `204 No Content` — successful operation with no response body, if used consistently.
- `400 Bad Request` — malformed request or invalid action.
- `401 Unauthorized` — missing or invalid authentication.
- `403 Forbidden` — authenticated user lacks permission.
- `404 Not Found` — resource not found or intentionally not disclosed.
- `409 Conflict` — duplicate or conflicting state.
- `422 Unprocessable Entity` — syntactically valid request that fails business validation, if adopted by the team.
- `500 Internal Server Error` — unexpected server failure.

## 8. Validation and errors

- Validate path parameters, query parameters and request bodies.
- Request-body validation uses Zod at the route boundary.
- Reject unknown or disallowed fields where appropriate.
- Do not trust role, student ID, lecturer ID or department scope supplied by the client; derive identity and permissions from the authenticated user and database relationships.
- Return useful messages without exposing stack traces, SQL details, secrets or internal implementation information.
- Log technical details safely on the server.

## 9. List endpoints

For list endpoints, agree on pagination before returning potentially large collections. A proposed convention is `page` and `limit`, with a documented maximum limit. Agree on filtering and sorting parameters per endpoint.

## 10. Contract change process

Before changing a route, payload or response:

1. Tell affected module owners.
2. Update this document or the API issue.
3. Identify frontend and backend consumers.
4. Keep changes backward-compatible where practical.
5. Include example requests/responses and tests in the PR.

## 11. Shared API bootstrap

- `GET /health` is a liveness check. It returns `{ "success": true, "data": { "status": "ok" } }` and does not query the database.
- `GET /health/ready` checks PostgreSQL with a read-only `SELECT 1`. It returns HTTP `200` with database status `connected` when ready, or HTTP `503` with status `unavailable` if the database cannot be reached. Error details and connection information are not exposed.
- Unknown routes return a consistent JSON error response.
- `backend/src/app.js` owns middleware and route mounting; `backend/src/server.js` owns process startup and shutdown.
- Errors use `{ "success": false, "message": "..." }`, with validation details only for client input errors. Internal exceptions are logged server-side and are not returned to clients.
- Application logs are structured JSON written to stdout/stderr. HTTP request completion logs include request ID, method, route, status, and duration; request bodies, query strings, and credentials are not logged. Set `LOG_LEVEL` to `debug`, `info`, `warn`, or `error` (default `info`).
- Startup and shutdown events, initial database connection success/failure, readiness failures, and unexpected server errors are logged. A database outage does not stop the API process; readiness remains `503` while liveness can remain `200`.