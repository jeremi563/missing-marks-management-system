# Implementation Tracker

**Review date:** 2026-11-15  
**Scope:** Current repository source, frontend, Prisma schema and migrations, tests, and project documentation. Findings below are based on code and test evidence in this checkout; a feature described in documentation is not treated as implemented without supporting code.

## Status key

- `[x] COMPLETE` — implemented and supported by code and tests.
- `[ ] PENDING` — not implemented or still requires an action/decision.
- `[~] PARTIAL` — implemented in part, but a material component is missing or inconsistent.
- `[?] UNVERIFIED` — implementation exists, but tests or deployment evidence are insufficient.

## Academic-year and lecturer assignments

- [x] **Standardize academic-year rules in application code.** The shared `shared/academic-year.js` utility is re-exported by the backend and frontend. It uses `Africa/Nairobi`, September 1–August 31, `YYYY/YY`, and derives a period's year only from `startsAt`. Attendance review uses the same bounds. Boundary and period-source behavior is covered in `backend/tests/shared/academic-year.test.js`.
- [x] **Validate academic periods.** Create requires `startsAt`; create and update reject periods whose `startsAt` and optional `endsAt` fall in different Nairobi academic years. Validation and service tests cover period boundaries and spanning dates (`backend/src/modules/admin/academic.validation.js`, `backend/src/modules/admin/academic.service.js`, and their tests).
- [x] **Preserve lecturer assignment history and enforce one active assignment.** COD replacement deactivates the current mapping, sets its end time, creates the new mapping, and audits the actor. Admin removal also deactivates instead of deleting. The forward migration adds `is_active`, retains null-year mappings as inactive, and creates a partial unique index for one active mapping per unit/year. Assignment and replacement cases have focused tests.
- [x] **Allow authorized COD report reassignment.** Outstanding reports can be listed and reassigned only by a designated COD for the report's department. The target lecturer must be actively assigned for the academic period's year; the reassignment records previous/new lecturer, actor, reason, and audit history. Focused tests are in `backend/tests/cod/cod-reassignment.test.js`.
- [ ] **Deploy the academic-year/history migration.** `backend/prisma/migrations/20261115121500_standardize_academic_year_and_assignment_history/migration.sql` exists but has not been applied. No database was queried or changed during this review. Deployment and database-state verification remain separate from implementation completion.
- [ ] **Correct the stale academic-period UI test expectation.** `frontend/tests/ui/admin-lecturer-academic.test.jsx` uses `startsAt: 2026-08-31T00:00:00Z` but expects `2026/27`; that instant is still August 31 in Nairobi and correctly renders `2025/26`. The current UI test suite therefore has one failing assertion; update the fixture or expected value.
- [ ] **Close GitHub issue #92.** The implementation is present in this checkout, but `[Architecture] Standardize Academic-Year Rules and Lecturer Assignments` remains open and the migration is not deployed.

## Missing-mark reporting and decisions

- [x] **Core report lifecycle.** Student submission validates ownership/enrollment and routes to the active year-matched lecturer when one exists. Lecturer work, decisions, escalation, COD decisions, and status/audit history are implemented in backend services and routes; corresponding student, lecturer, and COD screens exist. Relevant service and workflow tests are present.
- [x] **Outstanding-report reassignment.** COD reassignment is implemented as described above; report history and prior decisions are retained rather than rewritten.
- [ ] **Agree and document duplicate-report policy.** Current behavior permits duplicate submissions, as documented in `docs/API.md`; there is no agreed deduplication rule or corresponding uniqueness constraint. Define what makes two reports duplicates before changing behavior.

## Mark corrections

- [~] **Complete the mark-correction lifecycle.** A lecturer can propose a correction for an approved report; the service checks the assessment maximum and prevents multiple pending proposals. `MarkCorrection` has reviewer/final-value fields, but there is no reviewer decision service, route, or UI to approve/reject and apply a correction to an authoritative mark record.
- [ ] **Define correction authority and source of truth.** The authorized reviewer and authoritative mark system must be decided before implementing approval, rejection, audit, and propagation. See `docs/REQUIREMENTS.md`.

## Student appeals

- [x] **Backend appeal eligibility and COD decision flow.** The API enforces rejected-report eligibility, a configurable appeal window, one appeal per report, department-scoped COD decisions, history, and notifications. Feature 5 service tests cover decisions and authorization.
- [~] **Show appeal status and complete student appeal discovery.** `StudentAppeals.jsx` loads `getStudentReports()` without pagination and checks `report.appeals`, but the report-list response does not include appeals. The page does not use the available `GET /student/appeals` endpoint, so it can omit older rejected reports and cannot reliably show an existing appeal's status or prevent offering a duplicate. Add pagination and render the appeal list/status from the appeals API.

## Attendance management

- [x] **Core session and student check-in API.** Session types include CLASS, CAT, and EXAM; check-in verifies the session, enrollment, time window, and browser-provided location before creating a record. Backend tests cover checks and failures. Browser/device location is client-reported and is not tamper-proof.
- [x] **Dual-control attendance correction API.** COD authorization and administrator application are separate steps. The application is transactional, audited, concurrency-checked, and limited to session attendance records. `backend/tests/admin/admin-attendance-correction.test.js` covers authorization, repeated/concurrent attempts, rollback, and unsupported sources.
- [~] **Make attendance discrepancy workflows usable in the portal.** Student and lecturer APIs support submission, review/clarification, and history; COD APIs support detail, decisions, and audit; the administrator API applies authorized corrections. The frontend has no student or lecturer discrepancy workflow call sites, the COD `CodAttendance.jsx` only lists records, and no UI calls the admin correction API.
- [~] **Show corrected attendance and all student history.** The student API returns correction metadata, but `StudentAttendance.jsx` renders the historical `record.status` without showing the corrected status/provenance. It also fetches attendance without pagination although the API is paginated.
- [~] **Enforce discrepancy source integrity in the database.** The service validates that a discrepancy has exactly one source (session record, assessment attendance, or attempt), but the schema has three nullable source IDs and no database XOR check. Direct or alternate database writes can bypass service validation.

## Assessment and CAT management

- [~] **Complete CAT submission and assessment-attendance workflows.** Assessment setup and CAT/EXAM attendance sessions exist, and COD has read-only assessment-attendance/report-detail queries. `CatSubmission` and `AssessmentAttendance` are represented in Prisma, but no application create/verification workflow or corresponding student/lecturer submission UI was found.
- [ ] **Specify the exam-booklet QR process.** Scanning, matching, and exception handling are still described as a discussed workflow in `docs/WORKFLOW.md`, not an implemented feature.

## Evidence management

- [~] **Provide private evidence upload, storage, and retrieval.** Evidence metadata models and validation exist, and authorized report/case responses can expose safe metadata. No file-byte upload, durable private storage, or retrieval route is implemented; `docs/API.md` says file access is deferred until a storage provider and policy are selected.
- [ ] **Approve evidence access and retention rules.** Select the storage approach and define who may upload/view evidence, allowed file types/limits, retention, and audit requirements before adding file handling.

## Authentication and security

- [x] **Enforce authenticated sessions and role/ownership checks.** Cookie/JWT authentication checks the current user, active state, role, and `sessionVersion`; route modules apply authentication and authorization middleware. Password reset increments `sessionVersion`.
- [ ] **Revoke sessions after an authenticated password change.** `changePassword` updates the password but does not increment `sessionVersion`, unlike `resetPassword`, so existing sessions remain valid until expiry.
- [~] **Make lecturer-registration department choices consistent with submit validation.** `listRegistrationDepartments` returns every department, while registration submission rejects departments without an active designated COD. Filter the choices or otherwise make the eligibility limitation clear; the current auth test explicitly expects all departments.
- [~] **Align account removal with retention behavior.** `DELETE /admin/users/:id` can hard-delete eligible student accounts through `deleteStudentUser`, while API and requirements documentation describe account deactivation/retention. Align endpoint behavior, tests, and documentation with the approved policy.
- [?] **Verify email delivery operations.** Email sending is conditional on SMTP and failures are logged while generic responses are returned. Source-level handling exists, but no live SMTP delivery/monitoring evidence is available from this review.

## Administration

- [x] **Provide core administration screens.** The frontend includes user management, approvals, department management, academic records, settings, and COD/lecturer assignment views; corresponding protected APIs exist.
- [~] **Expose remaining administrative APIs in the UI.** API wrappers/routes exist for roster import, report/audit views and exports, report reopen/reassignment, public-holiday management, and attendance correction, but no corresponding admin feature screens/call sites were found.

## Notifications

- [x] **Implement in-app notification outbox processing.** The worker claims leased events, avoids duplicate concurrent delivery, rechecks eligibility, and retries transient failures. `backend/tests/shared/notification-outbox.test.js` covers these behaviors.
- [?] **Verify deployed notification delivery.** The outbox logic is covered by isolated tests, but successful operation of the separately run worker and real email provider is environment/deployment-dependent and was not verified here.

## Testing, CI/CD and documentation

- [x] **Keep focused backend checks available.** The documented database-independent command `cd backend && node --test tests/shared/*.test.js tests/lecturer/lecturer.validation.test.js` passed 118 tests during this review. A further isolated run of attendance-correction, discrepancy, and appeal workflow tests passed 77 tests.
- [x] **Provide frontend unit/lint/build and Prisma checks.** `cd frontend && npm test` passed 2 tests; `cd frontend && npm run lint` and `cd frontend && npm run build` passed in the latest development checks. `cd backend && npm run db:validate` also passed. The build reports an advisory main-chunk size above 500 kB; Prisma validation does not establish that migrations are deployed.
- [~] **Restore a green frontend UI suite.** `cd frontend && npm run test:ui` ran 45 tests: 44 passed and the academic-period expectation above failed.
- [?] **Verify the full backend suite.** A prior `cd backend && npm test` attempt did not pass: the configured database URL/credentials were invalid for DB-backed tests. The full suite has not been verified against a dedicated local test database; do not infer a green suite from the focused tests.
- [ ] **Add CI automation.** No `.github/workflows` files are present. Add pull-request checks for safe backend tests, frontend unit/UI tests, lint/build, Prisma validation, and isolated database-backed tests where appropriate.
- [ ] **Add backend linting.** `backend/package.json` has no lint script or backend lint configuration.
- [ ] **Replace the root placeholder test script.** Root `npm test` exits with “no test specified”; use package-specific commands or define a working root test entry point.
- [~] **Keep documentation and policy decisions aligned with behavior.** `docs/REQUIREMENTS.md` still contains open policy questions, including the distinction between COD and Academic Officer, report states, attendance authority, and appeal/evidence handling. Update requirements/API/workflow docs when those decisions are approved and behavior changes.

## Other outstanding issues

- [ ] **Resolve remaining business-policy questions before extending workflows.** The requirements register still calls out COD versus Academic Officer authority, report state transitions, attendance source/eligibility, appeal policy details, and evidence access. Do not infer policy from schema defaults.
- [~] **Treat browser location as advisory evidence.** Check-in validates submitted coordinates against a classroom boundary, but client-reported GPS cannot prove physical presence. Keep this limitation explicit in UI and policy; do not describe the check as tamper-proof.
- [?] **Verify deployed database state.** Prisma schema validation does not prove that a target database has applied the repository's migrations or preserves custom SQL constraints/indexes. The latest migration is known to be unapplied; no migration status or remote database was checked.
- [~] **Address frontend bundle-size advisory.** The production build succeeds, but Vite reports a main JavaScript chunk over 500 kB. Consider code splitting if performance measurements justify it.

## Review evidence and limits

- GitHub issue [#92 — Standardize Academic-Year Rules and Lecturer Assignments](https://github.com/jeremi563/missing-marks-management-system/issues/92) is still **open** and has no comments.
- The latest academic-year/history migration was **created but not applied**. Database deployment is not claimed complete.
- This tracker does not mark the testing category complete: the full backend suite is unverified, and the current frontend UI suite has one failing stale-date assertion.
- No application source, schema, migration, or configuration was changed to create this tracker.
