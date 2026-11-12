# API Contract and Conventions

## 1. Purpose and status

This document records the REST API conventions and the currently implemented role-based routes. Routes and workflow details are described in their module sections below; open decisions are identified where they still apply.

The shared Express application implements the health endpoint and authentication contract below. The role-module routes listed in this document are implemented; individual sections describe their request, response and authorization behavior.

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
| POST | `/api/v1/auth/register` | Register a student or begin a lecturer account request. |
| GET | `/api/v1/auth/departments` | List departments with an active designated COD for lecturer registration. |
| POST | `/api/v1/auth/register-department` | Match lecturer identity details to the pending account and submit it to a department COD. |
| POST | `/api/v1/auth/login` | Authenticate with a role-specific identifier and password. |
| POST | `/api/v1/auth/session/extend` | Extend the authenticated session before its JWT expires. |
| POST | `/api/v1/auth/verify-email` | Verify an email using a single-use token. |
| POST | `/api/v1/auth/resend-verification` | Request another email-verification message. |
| POST | `/api/v1/auth/forgot-password` | Request a password-reset message. |
| POST | `/api/v1/auth/reset-password` | Set a new password with a single-use token. |
| POST | `/api/v1/auth/change-password` | Change the authenticated user's password. |
| POST | `/api/v1/auth/change-email` | Change the authenticated user's email after confirming their current password. |
| POST | `/api/v1/auth/logout` | End the authenticated session/token where supported. |
| GET | `/api/v1/auth/me` | Return the authenticated user's permitted profile summary. |

### Registration and authentication

- Account creation and password reset require a password of at least 8 characters (maximum 128).
- Registration-number examples use placeholders: `AB` means any two letters, `01243` means any five digits, and `year` means a four-digit year; these are not fixed literal values.
- `POST /api/v1/auth/register` accepts `{ "displayName": "...", "registrationNumber": "...", "email": "...", "password": "..." }`. Student numbers follow `LL/DDDDD/YYYY` (for example, `AB/01243/2026`); staff numbers follow `LL/DDDD/identifier` (for example, `AB/0123/staffnumber`). A student number's year must not be later than the current year and it must match an administrator-imported roster entry and its email. A matching roster number and email complete student registration and verify the account, allowing immediate login; a retry can finish an existing unverified account linked to that same roster entry by setting the password again. Already verified accounts cannot be re-registered. A valid staff number not found in that roster creates an inactive pending lecturer account. Public registration cannot request COD or administrator access.
- Lecturer registration is a two-step process. After the shared registration form, the lecturer re-enters their name, email, staff number, and password in the department form and selects a configured department. `GET /api/v1/auth/departments` returns departments with a designated COD; `POST /api/v1/auth/register-department` accepts those repeated identity fields plus `departmentId` and verifies they match the original pending account before assigning the department. No duplicate account is created. The selected department's designated COD can approve or reject the lecturer. An approval activates the lecturer; lecturer/COD sign-in does not require email verification.
- Administrators create departments in Academic setup and assign each a unique two-uppercase-letter student-number prefix, such as `IN` for Computing. The Students page groups accounts by an exact, case-sensitive prefix match. CODs are promoted from active, approved lecturers on the Lecturers page; each department has one `designatedCodUserId`, and a lecturer can be designated in multiple departments. An administrator can still review department-registered applications, while `GET /api/v1/cod/pending-lecturer-approvals` and `PATCH /api/v1/cod/lecturer-approvals/:id` let a COD review only applicants belonging to their designated department. COD approval decisions cannot assign the COD role; administrators manage COD roles separately. Administrator numbers follow `admin/DD/YYYY` (for example, `admin/12/2026`), where `DD` is any two digits and `YYYY` is a four-digit year no later than the current year. They can only be created by an administrator or through the initial administrator bootstrap.
- `POST /api/v1/auth/login` accepts `{ "identifier": "...", "password": "..." }`; `identifier` must be the user's assigned registration number (student, staff, or administrator), and email login is not supported. Student numbers, staff numbers and administrator numbers are globally unique and normalized to uppercase. A lecturer/COD account may hold both staff roles and uses one staff number. Existing accounts must have an entry in `account_login_identifiers` to sign in by number; migration backfills identifiers from student and lecturer profiles and assigns a generated `ADMIN-<user-id>` identifier to existing administrators that had no administrator number.
- Login sets a 15-minute JWT in the `access_token` HttpOnly, SameSite=Strict cookie and returns its expiry timestamp. The cookie is Secure in production. The frontend warns the user two minutes before expiry.
- Authenticated `POST /api/v1/auth/session/extend` replaces the current JWT and cookie with a new 15-minute session and returns the new expiry timestamp. The current JWT must still be valid; expired sessions must sign in again.
- `POST /api/v1/auth/verify-email` accepts `{ "token": "..." }`. Verification tokens are single-use, expire after 24 hours, and are stored only as hashes.
- `POST /api/v1/auth/resend-verification` accepts `{ "email": "..." }`; the response does not disclose whether an account exists.
- `POST /api/v1/auth/forgot-password` accepts `{ "email": "..." }`; its response does not disclose whether an account exists. `POST /api/v1/auth/reset-password` accepts `{ "token": "...", "password": "..." }`. Reset tokens are single-use and expire after one hour.
- Authenticated `POST /api/v1/auth/change-password` accepts `{ "currentPassword": "...", "newPassword": "..." }`; it verifies the current password and requires the new password to be at least 8 characters.
- Authenticated `POST /api/v1/auth/change-email` accepts `{ "email": "...", "currentPassword": "..." }`; it verifies the current password and immediately updates the email without sending a verification link. The new email is marked verified, and outstanding email-change or verification links are invalidated.
- `POST /api/v1/auth/logout` clears the cookie. This is stateless logout; an already copied token remains valid until expiry.
- `GET /api/v1/auth/me` returns the authenticated user's ID, email, display name, database roles, and current session expiry timestamp.
- Protected middleware also accepts a Bearer token for non-browser clients. Roles are reloaded from PostgreSQL on each protected request, so role changes take effect immediately.
- Passwords are stored as bcrypt hashes. Set `JWT_SECRET` to a random secret of at least 32 characters. Never put the secret in source control.
- SMTP delivery is configured with `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, optional `SMTP_USER`/`SMTP_PASSWORD`, `SMTP_FROM`, and `APP_BASE_URL`. Verification/reset links lead to the frontend, which must submit the token to the corresponding API endpoint.
- Auth endpoints have per-IP in-memory rate limits. Deployments with multiple API instances should configure a shared rate-limit store.
- Existing approved accounts are backfilled as verified to preserve access. Existing student/lecturer profile identifiers are backfilled for identifier login; legacy COD accounts without a staff number can continue using email until an administrator assigns one.

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
| GET | `/api/v1/lecturer/course-units` | No body. | `200`, course units assigned to the authenticated lecturer, including department details. |
| GET | `/api/v1/lecturer/course-units/:courseUnitId/assessments` | UUID `courseUnitId`; required `type` query (`CAT` or `EXAM`). | `200`, matching assessments for a course unit assigned to the authenticated lecturer. |
| GET | `/api/v1/lecturer/students` | Optional `page` and `limit` (maximum 100). | `200`, students enrolled in the authenticated lecturer's assigned course units, with course unit and academic period details. |
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
| POST | `/api/v1/lecturer/attendance/sessions/:sessionId/start` | UUID `sessionId`; no body. | `200`, session with `active` status. |
| POST | `/api/v1/lecturer/attendance/sessions/:sessionId/end` | UUID `sessionId`; no body. | `200`, session with `completed` status. |
| GET | `/api/v1/lecturer/attendance/sessions/:sessionId/records` | UUID `sessionId`; no body. | `200`, attendance records with `count` and `data`, newest first. |

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
| Start attendance sessions | Implemented |
| End attendance sessions | Implemented |
| Retrieve attendance records | Implemented |
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
| GET | `/api/v1/cod/departments` | List departments currently designated to the authenticated COD. |
| GET | `/api/v1/cod/course-units` | List course units created for one designated department. Requires `departmentId`; supports `page` and `limit`. |
| GET | `/api/v1/cod/students` | List registered students for one designated department whose registration-number prefix matches its configured initials. Requires `departmentId`; supports `page` and `limit`. |
| GET | `/api/v1/cod/lecturers` | List active, approved lecturers registered under one designated department. Requires `departmentId`; supports `page` and `limit`. |
| POST | `/api/v1/cod/course-units/:courseUnitId/lecturers` | Assign an active, approved lecturer who is a member of the designated department to that department's course unit. Body: `{departmentId, lecturerProfileId}`. Duplicate assignments are rejected. |
| POST | `/api/v1/cod/course-units/:courseUnitId/lecturers` | Assign an active, approved lecturer who is a member of the designated department to that department's course unit. Body: `{departmentId, lecturerProfileId}`. Duplicate assignments are rejected. |
| GET | `/api/v1/cod/pending-lecturer-approvals` | List pending lecturer registrations assigned to this designated COD. |
| PATCH | `/api/v1/cod/lecturer-approvals/:id` | Approve or reject a lecturer registration in the COD's department; body contains `status`. |
| GET | `/api/v1/cod/reports/:id` | Retrieve an authorized departmental report and linked application records. Reports that have been escalated also include lecturer-decision history, escalation reason, report-scoped status/audit history and safe evidence metadata when present. |
| POST | `/api/v1/cod/reports/:id/assign` | Assign or reassign a report where permitted. |
| GET | `/api/v1/cod/reports/:id/comments` | List report comments available to staff in the authorized department. |
| POST | `/api/v1/cod/reports/:id/comments` | Add a private staff comment to a report. |
| POST | `/api/v1/cod/reports/:id/decision` | Record final approval or rejection of an escalated report; body contains `decision` (`APPROVE` or `REJECT`) and `reason`. |
| GET | `/api/v1/cod/appeals` | List appeals within the authorised scope. |
| GET | `/api/v1/cod/reports/overdue` | List overdue reports. |
| GET | `/api/v1/cod/appeals/:appealId` | Retrieve an appeal in the authorised department scope. |
| POST | `/api/v1/cod/appeals/:appealId/decision` | Decide a scoped appeal. |
| GET | `/api/v1/cod/appeals/overdue` | List overdue appeals. |
| GET | `/api/v1/cod/special-cases` | List departmental special cases. |
| GET | `/api/v1/cod/special-cases/:caseId` | Retrieve a scoped special case. |
| POST | `/api/v1/cod/special-cases/:caseId/decision` | Decide a scoped special case. |
| GET | `/api/v1/cod/special-cases/overdue` | List overdue special cases. |
| GET | `/api/v1/cod/special-case-categories` | List categories available to a designated COD. |
| POST | `/api/v1/cod/special-case-categories` | Create a category for an authorised department. |
| PATCH | `/api/v1/cod/special-case-categories/:id` | Update a category for an authorised department. |

COD report detail and comment routes require authentication, the `cod` role, and membership in the report's department. The detail response includes linked enrollment and, when the report is linked to an assessment in the same course unit, the student's CAT submission and assessment-attendance records. These are application records and are not represented as independently verified official university records. Missing application records do not establish that an academic event did not occur. The current schema does not link class attendance sessions to an academic period, so class attendance is not included in report-period review detail.

COD comment creation accepts `{ "body": "..." }`; the trimmed body must contain 1-2,000 characters. The API derives authorship from the authenticated user, stores COD comments as staff-private, and creates the comment and a `COD_REPORT_COMMENT_ADDED` audit event in one transaction. Audit metadata contains the new comment ID and does not contain its text.

COD escalated report listing reuses `GET /api/v1/cod/reports?status=ESCALATED`. COD final decisions use the separate decision endpoint and require a 1-2,000 character reason. The API records `ESCALATED` → `APPROVED`/`REJECTED`, actor, reason and timestamp in report status history and records `COD_REPORT_DECISION_RECORDED` in the audit log in one transaction. Conditional status updates reject repeated or concurrent decisions with a conflict response.

The decision sequence remains append-only in status history: lecturer decision (`PENDING` → `APPROVED`/`REJECTED`), lecturer escalation (`APPROVED`/`REJECTED` → `ESCALATED`), then COD final decision (`ESCALATED` → `APPROVED`/`REJECTED`). COD detail identifies the lecturer decision separately from any later final decision. Evidence details, when present, contain metadata only and omit `storageKey`; file upload, viewing and retrieval are deferred until a storage approach is agreed. COD does not review actual document contents through this API.

Separate workflow issue: student submission currently creates `Submitted`, while the lecturer decision endpoint requires `PENDING`; no transition between these states is implemented. Feature 4 does not change student or lecturer decision behavior. This requires separate approval and implementation.

### Departmental attendance and discrepancy workflow

All COD attendance endpoints require authentication, the `cod` role, and current designated-COD membership in the department derived through the attendance source's course unit. They do not infer absences from missing rows. Session attendance, assessment attendance and attempts are returned as separate source types.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/cod/attendance-records` | Paginated session attendance; supports department, course unit, student, status and date filters. |
| GET | `/api/v1/cod/assessment-attendance` | Paginated assessment attendance using supported scope filters. |
| GET | `/api/v1/cod/attendance-attempts` | Paginated attendance attempts; attempts are not confirmed attendance. |
| GET | `/api/v1/cod/attendance-records/:id/history` | Retrieve the linked snapshot and correction ledger for an authorized record. |
| GET | `/api/v1/cod/attendance-discrepancies/:id/audit` | Retrieve allowlisted COD audit events after visibility and provenance checks. |
| GET | `/api/v1/cod/attendance-summary` | Return separate source totals and correction/discrepancy totals. |
| GET | `/api/v1/cod/attendance-statistics` | Return status/outcome counts and source-specific rates. |
| GET | `/api/v1/cod/attendance-discrepancies` | Paginated departmental discrepancy queue. |
| GET | `/api/v1/cod/attendance-discrepancies/:id` | Retrieve a visible discrepancy and its source. |
| GET | `/api/v1/cod/attendance-discrepancies/:id/decisions` | Retrieve append-only decision history. |
| POST | `/api/v1/cod/attendance-discrepancies/:id/decisions` | Record a COD decision. Authorization requires an earlier recommendation. |
| POST | `/api/v1/cod/attendance-discrepancies/:id/revalidate-legacy-authorization` | Revalidate a legacy authorization with no source-status snapshot and record a fresh authorization. |

Student discrepancy workflow routes are protected by student authentication and scope sources and records to the authenticated student's own profile:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/student/attendance-discrepancies` | Submit a discrepancy for exactly one of the student's attendance sources. |
| GET | `/api/v1/student/attendance-discrepancies` | List the student's own submissions. |
| GET | `/api/v1/student/attendance-discrepancies/:id` | Retrieve one of the student's submissions. |
| POST | `/api/v1/student/attendance-discrepancies/:id/clarifications` | Respond to the latest clarification request as the original student reporter. |

Lecturer discrepancy workflow routes are protected by lecturer authentication and verify course-unit assignment and reporter/reviewer ownership:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/lecturer/attendance-discrepancies` | Submit a discrepancy for an assigned attendance source directly to COD review. |
| GET | `/api/v1/lecturer/attendance-discrepancies` | List assigned student submissions awaiting review and the lecturer's own submissions. |
| GET | `/api/v1/lecturer/attendance-discrepancies/:id` | Retrieve a visible assigned or self-reported discrepancy. |
| POST | `/api/v1/lecturer/attendance-discrepancies/:id/review` | Forward a student submission to COD or reject it with an explanation. |
| POST | `/api/v1/lecturer/attendance-discrepancies/:id/clarifications` | Respond to the latest clarification request as the original lecturer reporter. |

The Admin correction route is protected by administrator authentication and role authorization:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/admin/attendance-corrections` | Apply an eligible COD-authorized correction to a session attendance record. |

Malformed historical rows that fail recognized integrity checks are omitted from the returned page and counted in `integrity.skippedRecords`; pagination totals still count all matching source-scoped rows, so a page may contain fewer items. Unexpected database and application errors fail the request.

Only one active discrepancy may exist for the same student and attendance source across student and lecturer submissions. A duplicate submission returns `409 Conflict`. `PENDING_LECTURER_REVIEW`, `PENDING_COD_REVIEW`, `CLARIFICATION_REQUESTED`, `CORRECTION_RECOMMENDED` and `CORRECTION_AUTHORIZED` are active; authorization remains active until an Admin applies the correction. `CONFIRMED`, `REJECTED`, `LECTURER_REJECTED` and `CORRECTION_APPLIED` are terminal, after which a new discrepancy may be submitted.

Students submit their own discrepancy through `POST /api/v1/student/attendance-discrepancies` with exactly one source ID and a description, then monitor their own submissions through `GET /api/v1/student/attendance-discrepancies` and `GET /api/v1/student/attendance-discrepancies/:id`. Student submissions enter lecturer review. Lecturers use `POST /api/v1/lecturer/attendance-discrepancies` for assigned course-unit sources and submit directly to COD review; `GET /api/v1/lecturer/attendance-discrepancies` and `GET /api/v1/lecturer/attendance-discrepancies/:id` expose only assigned review work or the lecturer's own clarification requests. An assigned lecturer reviews a student report through `POST /api/v1/lecturer/attendance-discrepancies/:id/review` with `FORWARD_TO_COD` or `REJECT` and an explanation. Original reporters respond through `POST /api/v1/{student|lecturer}/attendance-discrepancies/:id/clarifications`; each response is linked to the latest clarification decision.

COD recommendation and authorization are separate append-only decisions. Authorization records the source status observed at authorization and never changes attendance. Older authorizations without that snapshot require the currently designated active COD to use `POST /api/v1/cod/attendance-discrepancies/:id/revalidate-legacy-authorization` with an explanation. Revalidation checks the original authorization history, discrepancy provenance, source ownership and current source eligibility, then records a fresh source-status snapshot linked to the original authorization without changing attendance. An authorized Admin applies supported session-record corrections through `POST /api/v1/admin/attendance-corrections` with the fresh `discrepancyDecisionId`, `correctedStatus` (`PRESENT`, `ABSENT`, or `LATE`) and `reason`. The transaction verifies the source still has the captured status, updates the current `AttendanceRecord`, adds a linked `AttendanceCorrection`, updates discrepancy state and writes an audit event; the existing `AttendanceHistory` snapshot is preserved. Assessment-attendance and attempt corrections are not supported by the current correction model.

### Administrator

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/admin/users` | List users within administrative permissions. |
| POST | `/api/v1/admin/users` | Create a user account. |
| PATCH | `/api/v1/admin/users/:id` | Update permitted account fields. |
| GET | `/api/v1/admin/pending-staff-accounts` | List department-registered lecturer applications awaiting approval. |
| PATCH | `/api/v1/admin/users/:id/approval` | Approve or reject a lecturer application after department registration; body contains only `status`. |
| POST | `/api/v1/admin/student-roster/import` | Import eligible student registration-number/email pairs. |
| GET | `/api/v1/admin/departments` | List departments. |
| POST | `/api/v1/admin/departments` | Create a department with its two-letter student-number initials. |
| PATCH | `/api/v1/admin/departments/:departmentId/designated-cod` | Assign or replace the department's single active COD. |
| GET | `/api/v1/admin/reports` | View system-wide report summaries within permissions. |
| GET | `/api/v1/admin/audit-logs` | View permitted audit records. |
| PATCH | `/api/v1/admin/settings` | Update permitted system settings. |

Administrator account management is restricted to authenticated users with the `administrator` role. Admin-created accounts are immediately approved and email-verified. `POST /api/v1/admin/users` creates administrator accounts with `adminNumber` in `admin/DD/YYYY` format. COD responsibility is assigned from the Lecturers page by promoting an active, approved lecturer in a selected department; the designation switch removes the previous COD role when that account is not designated in another department. The year in an administrator number cannot be later than the current year. These letters and digits describe the pattern and are not fixed values. Regular lecturer and student accounts are created through their registration workflows. The admin interface assigns one active COD to each department using `PATCH /api/v1/admin/departments/:departmentId/designated-cod` with `{ "codUserId": "..." }`; assignment adds membership before designation. `PATCH /api/v1/admin/users/:id/approval` accepts `{ "status": "APPROVED" | "REJECTED" }` and requires the pending lecturer to have completed department registration. COD decisions use the `/api/v1/cod/lecturer-approvals` endpoints and are restricted to the designated department COD. Approval activates the lecturer; staff sign-in does not require email verification. Pending staff remain inactive. Rejecting permanently deletes the pending applicant's account, staff profile, login identifier, department membership, and security tokens in the same transaction; an audit event records the decision without retaining the applicant's registration details. The roster import accepts `{ "students": [{ "studentNumber": "LL/DDDDD/YYYY", "email": "..." }] }` with at most 1,000 entries per request. Student accounts are grouped under a department in the Students page when the first two characters of their registration number exactly match that department's two-uppercase-letter initials (for example, `IN` for Computing); the comparison is case-sensitive. Student registration numbers, staff numbers, and administrator login numbers cannot be changed after account creation. User updates may change email, password, display name, active status, and roles. An administrator email change is immediately marked verified without sending a verification link and invalidates outstanding email verification links. Accounts are deactivated rather than deleted, and the last active administrator cannot be deactivated or lose the administrator role. User mutations create actor-attributed audit events transactionally. User listings support paginated `page`, `limit`, `search`, `role`, `approvalStatus`, and `isActive` filters and return operational account/profile data without password hashes.

`GET /api/v1/admin/users/:id` returns one account's roles, profile identifiers, department memberships, designated-COD membership indicators, and operational responsibility counts. It excludes password hashes, report content, comments, evidence, and official marks.

Phase 2 academic structure endpoints are also restricted to administrators:

| Method | Path | Purpose |
|---|---|---|
| GET, POST, PATCH | `/api/v1/admin/departments` and `/api/v1/admin/departments/:id` | Manage departments, unique department codes, and two-uppercase-letter student-number initials. |
| GET, POST, PATCH | `/api/v1/admin/course-units` and `/api/v1/admin/course-units/:id` | Manage course units and department relationships. |
| GET, POST, PATCH | `/api/v1/admin/academic-periods` and `/api/v1/admin/academic-periods/:id` | Manage academic periods. Overlapping periods are allowed. |
| GET, POST, DELETE | `/api/v1/admin/enrolments` and `/api/v1/admin/enrolments/:id` | Manage student-unit-period enrolments. Protected historical references prevent deletion. |
| GET, POST, DELETE | `/api/v1/admin/lecturer-mappings` and `/api/v1/admin/lecturer-mappings/:id` | Manage lecturer-to-unit mappings. Protected historical references prevent deletion. |
| GET, POST, PATCH | `/api/v1/admin/classrooms` and `/api/v1/admin/classrooms/:id` | Manage attendance classrooms and active status. |
| GET, POST, PATCH | `/api/v1/admin/assessments` and `/api/v1/admin/assessments/:id` | Manage unit assessments. |
| GET, POST, PATCH | `/api/v1/admin/assessment-types` and `/api/v1/admin/assessment-types/:id` | Manage the global assessment-type catalogue. |

Academic structure mutations validate related records, preserve protected history, and create actor-attributed audit events transactionally. Department creation requires a unique two-uppercase-letter `initials` value; department codes are optional but unique when provided. Administrators can update the department name, code, and initials; setting `code` to `null` clears it. Assessment creation records the administrator as the creating user. These endpoints do not alter official marks or report workflow decisions.

Enrolment creation requires an active user with the `student` role behind the selected student profile. Lecturer-mapping creation requires an active user with the `lecturer` role behind the selected lecturer profile. This prevents deactivated or role-inconsistent profiles from receiving new academic relationships.

Administrators cannot deactivate a designated COD or remove that user's `cod` role before changing the department designation. Administrators also cannot deactivate a lecturer or remove the `lecturer` role while that lecturer has unit mappings, assigned reports, or attendance sessions that require reassignment or resolution.

Department membership governance is available through:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/admin/departments/:departmentId/members` | List department members with optional role filtering. |
| POST | `/api/v1/admin/departments/:departmentId/members` | Add an active lecturer, COD, or administrator account to a department. |
| DELETE | `/api/v1/admin/departments/:departmentId/members/:userId` | Remove a department membership. |

The current designated COD cannot be removed from a department until the designation is changed. Designated-COD updates and public-holiday maintenance continue to use the existing Feature 5 services and transactional audit behavior; they are not duplicated in the administrator module.

Phase 3 operational endpoints are restricted to administrators:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/admin/settings` | List stored operational settings. |
| PATCH | `/api/v1/admin/settings/:key` | Update an explicitly allowlisted operational setting. |
| GET | `/api/v1/admin/reports` | View paginated system-wide report summaries and status aggregates. |
| GET | `/api/v1/admin/audit-logs` | View read-only, paginated audit records. |

The settings allowlist contains `notification_batch_size`, `notification_poll_interval_ms`, `max_page_size`, `attendance_minimum_percentage` (default `80`), `appeal_window_calendar_days` (default `14`), `overdue_notifications_enabled` (default `true`), and `notification_retry_limit` (default `5`). Lecturer, COD, and special-case review deadline settings remain excluded until separately approved. Existing deadline snapshots are never recalculated when settings change. Report summaries omit report descriptions, comments, evidence, and official marks; audit queries support action, entity type, actor, and date filters.

Controlled CSV exports are available to administrators:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/admin/reports/export` | Export operational report-summary columns as CSV. |
| GET | `/api/v1/admin/audit-logs/export` | Export filtered audit records as CSV. |

Both exports accept the relevant report or audit filters and a `maxRows` value from `1` to `5000`, defaulting to `1000`. Report exports exclude descriptions, comments, evidence, and official marks. Export requests are transactionally recorded as audit events; an audit export event appears in later audit exports, not the snapshot that initiated it.

The administrator dashboard is available at `GET /api/v1/admin/dashboard`. It returns read-only aggregate counts for active and total users, active students and lecturers, departments, course units, academic periods, enrolments, lecturer mappings, active classrooms, assessments, and report counts by status. It does not expose individual student records, report descriptions, comments, evidence, or marks.

Approved administrator maintenance actions are:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/admin/reports/:reportId/reopen` | Reopen a rejected or withdrawn report to `PENDING` with a required reason. |
| POST | `/api/v1/admin/reports/:reportId/reassign` | Reassign an unresolved report to an active lecturer mapped to its course unit. |

Both actions reject reports with unresolved appeals or special cases, preserve status/assignment history, and create audit events without sending notifications. Reopening clears the current lecturer assignment so the report can be assigned afresh.

Attendance, CAT, examination-attendance, special-case and export endpoints are documented in their module sections above. Attendance corrections through Admin apply only to session attendance records; the current correction schema does not support assessment attendance or attempts.

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

## Feature 5: missing-mark workflow

All paths below use `/api/v1`; protected paths require the listed role and authenticate through the existing middleware.

| Method and path | Role | Behaviour |
|---|---|---|
| `GET /student/appeals`, `GET /student/appeals/:appealId` | Student | List/view only the authenticated student's appeals and final reasons. |
| `POST /student/reports/:reportId/appeals` | Student | Submit one appeal for an owned `REJECTED` report within 14 calendar days of its recorded rejection. Body: `{reason, comments?}`. |
| `POST /student/reports/:reportId/special-cases` | Student | Submit a case for an owned report in `PENDING`, `ESCALATED`, or `REJECTED`. Body: `{categoryId, description}`. |
| `GET /student/special-cases`, `GET /student/special-cases/:caseId` | Student | List and view cases submitted by the authenticated student, including decisions; evidence bytes are not served. |
| `GET /lecturer/assessment-types` | Lecturer | List active decision assessment types. |
| `POST /lecturer/reports/:reportId/start` | Lecturer | Start work on the currently assigned pending report once. |
| `POST /lecturer/reports/:reportId/decision` | Lecturer | Final decision requires `decision`, `reason`, and active `assessmentTypeId`; `assessmentTypeOtherDescription` is required only for `OTHER`. |
| `POST /lecturer/reports/:reportId/special-cases` | Lecturer | Submit a case for a currently assigned eligible report. Body: `{categoryId, description}`. |
| `GET /lecturer/special-cases`, `GET /lecturer/special-cases/:caseId` | Lecturer | List submitted cases and view own/currently assigned report cases. Evidence metadata is visible only to the current assignee. |
| `GET /cod/appeals`, `GET /cod/appeals/:appealId` | COD | List and view appeals for departments where the caller is the designated COD. Optional list query: `page`, `limit`, `status`. |
| `POST /cod/appeals/:appealId/decision` | COD | Decide once. Body: `{decision: "APPROVE"|"REJECT", reason}`. Approval returns the report to `PENDING`. |
| `GET /cod/special-cases`, `GET /cod/special-cases/:caseId` | COD | List and view cases only for designated departments. Optional list query: `page`, `limit`, `status`. |
| `POST /cod/special-cases/:caseId/decision` | COD | Decide once. Body: `{decision: "APPROVE"|"REJECT", reason}`. This does not change report status. |
| `GET /cod/special-case-categories` | COD | List categories for category management. Caller must be designated COD. |
| `POST /cod/special-case-categories`, `PATCH /cod/special-case-categories/:id` | COD | Create/update categories using `code`, `name`, optional `description`, and update-only `isActive`. |
| `GET /cod/reports/overdue`, `GET /cod/appeals/overdue`, `GET /cod/special-cases/overdue` | COD | Paginated unresolved overdue work for the caller's designated departments. |
| `GET /public-holidays?from=YYYY-MM-DD&to=YYYY-MM-DD` | Public | Read the holiday calendar. |
| `POST /admin/public-holidays`, `PATCH /admin/public-holidays/:id`, `DELETE /admin/public-holidays/:id` | Administrator | Maintain holidays. Create/update body: `{date, name, source?, description?}`. Existing deadlines are not recalculated. |
| `PATCH /admin/departments/:departmentId/designated-cod` | Administrator | Assign a department's COD. Body: `{codUserId}`; target must be active, have the COD role, and be a member of that department. |

Special-case evidence upload/download is not exposed because no private storage provider has been selected. Existing report-level evidence metadata remains available through the COD report review. No API response includes a storage key.
