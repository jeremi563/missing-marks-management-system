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

All routes below are mounted under `/api/v1/lecturer`. Each requires a valid authenticated user with the `lecturer` role. The lecturer identity is derived from the authenticated user; clients must not supply a lecturer profile ID to determine ownership. Report and attendance-session access is restricted to the authenticated lecturer's assigned records. Records outside that scope return `404`.

| Method | Path | Request | Success |
|---|---|---|---|
| GET | `/api/v1/lecturer/reports` | Optional pagination and supported report filters. No body. | `200`, assigned reports and pagination. |
| GET | `/api/v1/lecturer/reports/:reportId` | UUID `reportId`; no body. | `200`, individual assigned report. |
| GET | `/api/v1/lecturer/reports/:reportId/comments` | UUID `reportId`; no body. | `200`, comments associated with the report. |
| POST | `/api/v1/lecturer/reports/:reportId/comments` | UUID `reportId`; validated comment payload. | `201`, created comment. |
| POST | `/api/v1/lecturer/reports/:reportId/decision` | UUID `reportId`; validated approval or rejection decision payload. | `200`, updated report decision. |
| POST | `/api/v1/lecturer/reports/:reportId/escalate` | UUID `reportId`; `{ "reason": "..." }` with a trimmed 1-2,000 character reason. Requires an assigned lecturer decision of `APPROVED` or `REJECTED`. | `200`, report status `ESCALATED` and escalation history. |
| POST | `/api/v1/lecturer/reports/:reportId/corrections` | UUID `reportId`; validated mark-correction proposal payload. | `201`, submitted correction proposal. |
| POST | `/api/v1/lecturer/attendance/sessions` | Attendance session details: `sessionType`, `courseUnitId`, `classroomId`, optional `assessmentId`, `startsAt`, and optional `endsAt`. | `201`, created session and generated QR token. |
| GET | `/api/v1/lecturer/attendance/sessions` | Optional `page`, `limit`, `courseUnitId`, `sessionType`, and `status`. No body. | `200`, lecturer's attendance sessions and pagination. |
| GET | `/api/v1/lecturer/attendance/sessions/:sessionId` | UUID `sessionId`; no body. | `200`, individual attendance session. |
| POST | `/api/v1/lecturer/attendance/sessions/:sessionId/start` | UUID `sessionId`; no body. | Planned: start attendance session. |
| POST | `/api/v1/lecturer/attendance/sessions/:sessionId/end` | UUID `sessionId`; no body. | Planned: end attendance session. |
| GET | `/api/v1/lecturer/attendance/sessions/:sessionId/records` | UUID `sessionId`; optional pagination if supported by the final implementation. | Planned: attendance records for the session. |

### Lecturer request and behaviour details

#### 1. Authentication and ownership

- All Lecturer Module endpoints require authentication and the `lecturer` role.
- The lecturer profile is resolved using the authenticated user's identity.
- Clients must not provide a lecturer profile ID to access another lecturer's records.
- Lecturers can only retrieve reports and attendance sessions within their permitted ownership or assignment scope.
- An attendance session belonging to another lecturer is not accessible through the individual session endpoint.

#### 2. Missing-mark report management

- The report listing endpoint retrieves reports assigned to the authenticated lecturer.
- Individual report retrieval uses a valid report UUID.
- Comments are associated with the relevant report.
- Comment submission is validated to reject missing, empty, or whitespace-only comments.
- Leading and trailing whitespace is trimmed.
- Comments must contain between 1 and 2,000 characters.
- The lecturer's identity is derived from authentication rather than supplied by the client.
- Report decisions support approval and rejection.
- A lecturer may escalate only their assigned report after an `APPROVED` or `REJECTED` decision. Escalation records `APPROVED`/`REJECTED` → `ESCALATED` status history and a `REPORT_ESCALATED` audit event in one transaction; the lecturer decision history remains unchanged.
- Appeals following a lecturer's rejection are handled by the COD module, not the Lecturer Module.
- Mark-correction proposals are submitted separately from report decisions. Submitting a proposal does not directly modify the official student marks.

#### 3. Attendance session management

The Lecturer Module uses one unified attendance-session API for three session types:

| Session type | Description | Assessment requirement |
|---|---|---|
| `CLASS` | Regular classroom attendance. | No assessment required. |
| `CAT` | Continuous Assessment Test attendance. | Existing registered CAT assessment required. |
| `EXAM` | Examination attendance. | Existing registered EXAM assessment required. |

Attendance session creation accepts the following fields:

| Field | Requirement | Description |
|---|---|---|
| `sessionType` | Required | `CLASS`, `CAT`, or `EXAM`. |
| `courseUnitId` | Required | UUID of the selected course unit. |
| `classroomId` | Required | UUID of the registered classroom. |
| `assessmentId` | Conditional | Required for CAT and EXAM; must not be supplied for CLASS. |
| `startsAt` | Required | Valid ISO datetime with timezone offset. |
| `endsAt` | Optional | Valid ISO datetime with timezone offset, later than `startsAt`. |

Additional business rules:

- The lecturer must be assigned to the selected course unit.
- The classroom must exist and be active.
- A CAT session must reference an existing CAT assessment.
- An EXAM session must reference an existing EXAM assessment.
- The selected assessment must belong to the selected course unit.
- A CLASS session must not reference an assessment.
- The session is created with the initial `scheduled` status.
- Attendance sessions are associated with registered classrooms to support GPS-based location verification.

#### 4. Attendance listing and retrieval

The attendance-session listing endpoint supports filtering by:

- `courseUnitId`
- `sessionType`
- `status`

Pagination uses:

- `page`: integer of at least `1`, default `1`.
- `limit`: integer from `1` to `100`, default `10`.

The listing response includes attendance sessions, their relevant course unit, classroom and assessment information where available, record counts, and pagination metadata.

The individual session endpoint retrieves a session only when it belongs to the authenticated lecturer.

#### 5. QR-code and GPS attendance workflow

All three attendance types (`CLASS`, `CAT`, and `EXAM`) are designed to use QR-code and GPS-based verification.

**QR-code workflow:**

1. The lecturer creates an attendance session.
2. The backend generates a cryptographically secure random QR token.
3. The backend stores the SHA-256 hash of the token in the database rather than storing the raw token.
4. The raw token is returned in the session creation response for frontend QR-code generation.
5. The student scans the generated QR code.
6. The Student Module handles token submission and verification.

**GPS workflow:**

1. The attendance session is associated with a registered classroom.
2. The Student Module obtains the student's coordinates, subject to device permission.
3. The student's location is checked against the registered classroom location.
4. The location verification result contributes to attendance validation.

**Module responsibilities:**

| Responsibility | Module |
|---|---|
| Create attendance sessions | Lecturer |
| Generate and securely store QR tokens | Backend attendance service |
| Display QR-code images | Frontend |
| Scan QR codes | Student |
| Submit QR tokens | Student |
| Collect and submit GPS coordinates | Student |
| Verify student attendance submissions | Student-side attendance backend |
| View attendance sessions | Lecturer |
| View attendance records | Lecturer |

GPS is an additional verification mechanism, not conclusive proof of physical presence. Location readings can be inaccurate or manipulated.

The Lecturer Module's session creation, listing, and individual retrieval endpoints are implemented. Student-side QR scanning and GPS verification are separate integration responsibilities and should not be considered operational until implemented and tested.

#### 6. CAT submission and examination review

CAT submission review and examination-specific academic review are separate from attendance session management.

The unified attendance API supports CAT and EXAM session creation. It does not, by itself, implement CAT submission review or examination-specific academic review endpoints.

No additional CAT submission or examination-review routes should be treated as available until they are registered and verified in the implementation.

### Validation and response behaviour

- Request payloads and route parameters are validated before controller execution.
- Report and attendance-session identifiers must be valid UUIDs.
- Invalid request data returns `400`.
- Missing authentication returns `401`.
- Missing lecturer profile or records outside the lecturer's permitted scope return `404`.
- Business-rule or state conflicts are returned using the appropriate application error status.
- Unexpected server or database errors are handled by the application's error middleware.

Successful list responses follow the standard response envelope:

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "count": 0,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 0
  }
}
```

Successful individual reads and writes follow the standard response envelope:

```json
{
  "success": true,
  "message": "Request completed successfully.",
  "data": {}
}
```

The attendance session creation response additionally provides the generated QR token alongside the created session.

### Implementation status

| Feature | Status |
|---|---|
| Retrieve assigned missing-mark reports | Implemented |
| Retrieve individual missing-mark reports | Implemented |
| Retrieve report comments | Implemented |
| Add investigation comments | Implemented |
| Submit approval/rejection decisions | Implemented |
| Submit mark-correction proposals | Implemented |
| Create CLASS, CAT, and EXAM sessions | Implemented |
| List attendance sessions | Implemented |
| Retrieve individual attendance sessions | Implemented |
| Start attendance sessions | Pending |
| End attendance sessions | Pending |
| Retrieve attendance records | Pending |
| Student QR-code scanning and submission | Student Module integration pending |
| Student GPS collection and verification | Student Module integration pending |
| CAT submission review | Not confirmed |
| Examination-specific academic review | Not confirmed |

**Integration note:** This API reference describes the Lecturer Module development record. Before integrating, confirm the exact request payload fields and response structures against the corresponding validation schemas and controllers. Also confirm that the routes have been merged into the shared `develop` branch before treating them as available to other modules.

---

**Module:** Lecturer Module  
**Project:** Web Based Missing Marks Management System  
**Base Path:** `/api/v1/lecturer`

### COD / Academic Officer

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/cod/reports` | List departmental reports. |
| GET | `/api/v1/cod/reports/:id` | Retrieve an authorized departmental report and linked application records. Reports that have been escalated also include lecturer-decision history, escalation reason, report-scoped status/audit history and safe evidence metadata when present. |
| POST | `/api/v1/cod/reports/:id/assign` | Assign or reassign a report where permitted. |
| GET | `/api/v1/cod/reports/:id/comments` | List report comments available to staff in the authorized department. |
| POST | `/api/v1/cod/reports/:id/comments` | Add a private staff comment to a report. |
| POST | `/api/v1/cod/reports/:id/decision` | Record final approval or rejection of an escalated report; body contains `decision` (`APPROVE` or `REJECT`) and `reason`. |
| GET | `/api/v1/cod/appeals` | List appeals within the authorised scope. |
| GET | `/api/v1/cod/reports/overdue` | List overdue reports. |

COD report detail and comment routes require authentication, the `cod` role, and membership in the report's department. The detail response includes linked enrollment and, when the report is linked to an assessment in the same course unit, the student's CAT submission and assessment-attendance records. These are application records and are not represented as independently verified official university records. Missing application records do not establish that an academic event did not occur. The current schema does not link class attendance sessions to an academic period, so class attendance is not included in report-period review detail.

COD comment creation accepts `{ "body": "..." }`; the trimmed body must contain 1-2,000 characters. The API derives authorship from the authenticated user, stores COD comments as staff-private, and creates the comment and a `COD_REPORT_COMMENT_ADDED` audit event in one transaction. Audit metadata contains the new comment ID and does not contain its text.

COD escalated report listing reuses `GET /api/v1/cod/reports?status=ESCALATED`. COD final decisions use the separate decision endpoint and require a 1-2,000 character reason. The API records `ESCALATED` → `APPROVED`/`REJECTED`, actor, reason and timestamp in report status history and records `COD_REPORT_DECISION_RECORDED` in the audit log in one transaction. Conditional status updates reject repeated or concurrent decisions with a conflict response.

The decision sequence remains append-only in status history: lecturer decision (`PENDING` → `APPROVED`/`REJECTED`), lecturer escalation (`APPROVED`/`REJECTED` → `ESCALATED`), then COD final decision (`ESCALATED` → `APPROVED`/`REJECTED`). COD detail identifies the lecturer decision separately from any later final decision. Evidence details, when present, contain metadata only and omit `storageKey`; file upload, viewing and retrieval are deferred until a storage approach is agreed. COD does not review actual document contents through this API.

Separate workflow issue: student submission currently creates `Submitted`, while the lecturer decision endpoint requires `PENDING`; no transition between these states is implemented. Feature 4 does not change student or lecturer decision behavior. This requires separate approval and implementation.

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
