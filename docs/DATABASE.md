# Database Design and Coordination

## 1. Purpose

This document sets the conventions for the shared PostgreSQL database and Prisma schema. The schema is a shared project resource: changes must be coordinated to prevent migration conflicts and inconsistent assumptions between modules.

## 2. Database principles

- Use one PostgreSQL database for the application.
- Use Prisma as the agreed ORM and migration tool.
- Use UUID primary keys for core records unless the team agrees otherwise.
- Use consistent `snake_case` names for database tables and columns.
- Include creation and update timestamps where appropriate.
- Use explicit foreign-key relations and appropriate indexes.
- Apply unique constraints for genuine business uniqueness rules.
- Keep business rules in services, not only in frontend validation.
- Never use real student information as seed or demo data.

## 3. Core entities in the current schema

The following core models are implemented in the shared Prisma schema. Exact fields and relationships are listed in sections 10–14 below. Treat this as the team's working baseline and review the open policy decisions before applying the initial migration to a shared database.

| Entity | Purpose |
|---|---|
| `User` | Login identity, account status and system role or role assignments. |
| `StudentProfile` | Student-specific profile and institutional identifier. |
| `LecturerProfile` | Lecturer-specific profile and staff identifier. |
| `Department` | Academic department or organisational unit. |
| `CourseUnit` | A course/unit offered by the institution. |
| `UnitEnrollment` | Relationship between a student and a unit for an academic period. |
| `MissingMarkReport` | A student's missing-mark case and its current status. |
| `AttendanceSession` | A class or attendance event created by an authorised lecturer. |
| `AttendanceRecord` | A student's attendance record for a session. |
| `Appeal` | An appeal associated with a report, subject to the approved policy. |
| `Notification` | A notification for an authorised user. |
| `AuditLog` | Trace of important actions and decisions. |

The schema also includes assessments, classrooms, CAT/examination attendance, report comments and histories, attendance attempts/corrections/discrepancies, special cases/evidence, eligibility snapshots, mark corrections, system settings and excused-attendance requests. These are enumerated in the full table reference below. Coordinate additions or changes; do not create duplicate module-specific tables.

## 4. Decisions to confirm before treating the model as final

The current schema uses conservative, flexible relations where the docs leave policy open. Confirm the following with the team/stakeholders before freezing enums, adding policy-specific constraints or applying to a shared database:

- Whether one user can have more than one role.
- Whether COD and Academic Officer are the same role or separate roles.
- How departments relate to courses/units and lecturers.
- How academic years, semesters and class groups are represented.
- The academic-period and enrollment uniqueness convention, including academic years, semesters and class groups.
- Whether every report must reference a configured `Assessment` or whether the existing assessment-component field is enough.
- Whether report assignment/comment histories require further retention or edit rules.
- Whether a class session may omit a classroom and how each attendance session maps to the official class structure.
- Whether the proposed appeal cap and active-report duplicate rule are approved and how to enforce them under concurrent requests.
- Which actions require audit records and what metadata is safe to store.

## 5. Prisma conventions

- Keep the shared schema in `backend/prisma/schema.prisma`.
- Use Prisma model names consistently (commonly singular PascalCase).
- Map database table and column names to `snake_case` using Prisma mapping where required.
- Name relations clearly, especially where a model has multiple relations to `User`.
- Use enums only for stable, agreed sets of values. If values are expected to be configurable, discuss a related table instead.
- Use transactions when multiple database changes must succeed or fail together.
- Avoid deleting records that are required for academic or audit history; agree on archival/retention rules.
- Add indexes based on query patterns and foreign keys, not indiscriminately.

## 6. Migration workflow

The team lead coordinates schema and migration integration unless the team assigns another maintainer.

1. A contributor describes the feature and the data it needs.
2. The team checks whether an existing model or relation already represents the data.
3. Agree on the field names, types, nullability, relations, constraints and indexes.
4. The schema maintainer updates `schema.prisma` and creates the migration, or explicitly coordinates a contributor to do so.
5. Review the generated migration before applying it.
6. Test the migration against a local development database.
7. Include schema and migration changes in the PR with a clear explanation.
8. Merge only after review and confirmation that the migration is compatible with the current `develop` branch.

Do not have several contributors independently generate migrations from different versions of the shared schema and then merge them without coordination.

## 7. Seed data

Use synthetic, clearly labelled records for development:

- Demo administrator.
- Demo COD / Academic Officer.
- Demo lecturers.
- Demo students.
- Demo departments and units.
- Demo enrolments.

Never copy real student names, registration numbers, marks, passwords or other private data into the repository. Seed passwords must be non-production demo credentials and must be handled safely.

## 8. Environment variables

Keep variable names in `backend/.env.example` and actual local values in `backend/.env`. At minimum, the database connection will require a `DATABASE_URL` in the format supported by Prisma. Do not place actual credentials in this document or commit them to Git.

## 9. Schema change proposal template

When proposing a schema change in an issue or PR, include:

- Feature / user story:
- Why existing models are insufficient:
- Proposed model, fields and types:
- Relationships and deletion behaviour:
- Unique constraints and indexes:
- Which module will use the data:
- Migration impact:
- Privacy / audit considerations:

## 10. Current shared schema

The Prisma source of truth is `backend/prisma/schema.prisma`; the PostgreSQL URL is loaded by `backend/prisma.config.ts` from `DATABASE_URL`. Models use UUID primary keys and map to plural `snake_case` tables. Nullable fields are marked `?` in Prisma. PostgreSQL `Decimal` fields are noted with their precision.

This inventory documents the current schema, not a claim that every business rule is settled. In particular, workflow status values and several academic policies remain open in `REQUIREMENTS.md` and `WORKFLOW.md`. Flexible status/type values are stored as strings until the team approves stable enums.

### Identity and academic structure

| Table | Columns (Prisma field: type) | Purpose |
|---|---|---|
| `users` | `id: UUID`, `email: String`, `displayName: String?`, `passwordHash: String`, `isActive: Boolean`, `createdAt/updatedAt: DateTime` | Shared login identity. Email is unique. Password hashes only; never store raw passwords. |
| `roles` | `id: UUID`, `name: String`, `description: String?`, `createdAt: DateTime` | Configurable role names; role name is unique. |
| `user_roles` | `id: UUID`, `userId/roleId: UUID`, `createdAt: DateTime` | Many-to-many user-role assignments; `(userId, roleId)` unique. |
| `student_profiles` | `id: UUID`, `userId: UUID`, `studentNumber: String`, `officialEmail/notificationEmail: String?`, timestamps | Student identity and institutional number. `userId` and `studentNumber` are unique. |
| `lecturer_profiles` | `id: UUID`, `userId: UUID`, `staffNumber: String?`, timestamps | Lecturer profile; `userId` is unique and non-null staff numbers are unique. |
| `departments` | `id: UUID`, `name: String`, `code: String?`, timestamps | Academic department; non-null code is unique. |
| `department_memberships` | `id: UUID`, `userId/departmentId: UUID`, `createdAt: DateTime` | Links staff/accounts to departments; `(userId, departmentId)` unique. Role-specific access is still enforced in services. |
| `course_units` | `id: UUID`, `departmentId: UUID`, `code/name: String`, timestamps | A unit belongs to one department. `(departmentId, code)` is unique. |
| `academic_periods` | `id: UUID`, `code: String?`, `name: String`, `startsAt/endsAt: DateTime?`, `createdAt: DateTime` | Academic period referenced by enrollments and reports. A provided code is unique; the period naming convention is not yet fixed. |
| `unit_enrollments` | `id: UUID`, `studentProfileId/courseUnitId/academicPeriodId: UUID`, `createdAt: DateTime` | Student enrollment in a unit for a period; that three-column combination is unique. |
| `course_unit_lecturers` | `id: UUID`, `courseUnitId/lecturerProfileId: UUID`, `createdAt: DateTime` | Lecturer-to-unit assignment; pair is unique. |

### Reports and decisions

| Table | Columns (Prisma field: type) | Purpose |
|---|---|---|
| `assessments` | `id/courseUnitId: UUID`, `createdByUserId: UUID?`, `code: String?`, `name/type: String`, `assessmentDate: DateTime?`, `maximumMarks: Decimal(8,2)?`, `requiredForEligibility/attendanceRequired/submissionRequired: Boolean`, `qrReferenceHash: String?`, timestamps | Unit assessment, such as a CAT or exam. Optional QR reference is stored as a hash, not a raw bearer token. `(courseUnitId, code)` and non-null QR hash are unique. |
| `missing_mark_reports` | `id: UUID`, `reference: String`, `studentProfileId/courseUnitId/academicPeriodId: UUID`, `assessmentId: UUID?`, `assignedLecturerProfileId: UUID?`, `assessmentComponent/description/status: String`, `submittedAt: DateTime?`, timestamps | Missing-mark case. Reference is unique. Assessment may be absent until the team decides whether every report must select a configured assessment. |
| `report_comments` | `id/reportId/authorUserId: UUID`, `body: String`, `isStudentVisible: Boolean`, `createdAt: DateTime` | Append-only report comments. Staff comments default to private; an authorised lecturer may explicitly mark a comment student-visible. A student can see their own comments and comments marked visible. |
| `report_assignments` | `id/reportId/actorUserId/newLecturerProfileId: UUID`, `previousLecturerProfileId: UUID?`, `reason: String?`, `createdAt: DateTime` | Assignment/reassignment history; does not replace the report's current assigned lecturer. |
| `report_status_history` | `id/reportId: UUID`, `actorUserId: UUID?`, `previousStatus: String?`, `newStatus: String`, `reason: String?`, `createdAt: DateTime` | Audit-friendly history of status changes. Status strings are not a finalized enum. |
| `report_eligibility` | `id/reportId: UUID`, `checkedByUserId: UUID?`, `classification: String`, `attendancePercentage: Decimal(5,2)?`, class/CAT/exam eligibility booleans: `Boolean?`, `details: Json?`, `checkedAt: DateTime` | Snapshot of each eligibility calculation. Repeated checks are retained; threshold and classification rules come from approved configuration/services. |
| `mark_corrections` | `id/reportId/proposedByLecturerId: UUID`, `reviewedByUserId: UUID?`, `originalValue/finalValue: Decimal(8,2)?`, `proposedValue: Decimal(8,2)`, `status: String`, `reason/reviewComments: String?`, `decidedAt: DateTime?`, timestamps | Lecturer proposal and reviewer/COD outcome history. The application records proposals; it does not update official university results. |
| `appeals` | `id/reportId/studentProfileId: UUID`, `reason/status: String`, `comments: String?`, optional decision actor/time/reason and review deadline | One appeal per report, with COD decision and stored review deadline. |
| `special_cases` | `id/reportId: UUID`, nullable historical submitter, category lookup, description/status, optional decision actor/time/reason and review deadline | Multiple independent cases per report; historical category text is retained and submitter remains nullable for legacy rows. |
| `special_case_evidence` | `id/reportId/uploadedByUserId: UUID`, `appealId/specialCaseId: UUID?`, `originalName/storageKey/mediaType: String`, `sizeBytes: Int`, `createdAt: DateTime` | Metadata and storage key for permitted special-case documents; never store file bytes in this row. `storageKey` is unique. Access control and file-type/size validation belong in the service/API layer. |

### Attendance and assessment records

| Table | Columns (Prisma field: type) | Purpose |
|---|---|---|
| `classrooms` | `id: UUID`, `name: String`, `latitude/longitude: Decimal(9,6)`, `boundaryMeters: Int`, `isActive: Boolean`, timestamps | Reusable configured location. Classroom name is unique. |
| `attendance_sessions` | `id/courseUnitId/lecturerProfileId: UUID`, `classroomId/assessmentId: UUID?`, `accessTokenHash: String?`, `status: String`, `startsAt: DateTime`, `endsAt: DateTime?`, timestamps | Class or assessment attendance window. Optional classroom and assessment; token is stored hashed and is unique when present. |
| `attendance_attempts` | `id/sessionId/studentProfileId: UUID`, `outcome: String`, `failureReason: String?`, `occurredAt: DateTime` | Accepted or rejected attempt history, separate from successful attendance. Does not itself mark a student absent. |
| `attendance_records` | `id/sessionId/studentProfileId: UUID`, `status: String`, `locationVerified: Boolean`, `recordedAt/createdAt: DateTime` | Successful attendance record; `(sessionId, studentProfileId)` unique. |
| `attendance_history` | `id: UUID`, `attendanceRecordId: UUID?`, `studentProfileId: UUID`, `courseUnitCode/courseUnitName/status: String`, `sessionStartedAt/signedAt: DateTime`, `locationVerified: Boolean`, `createdAt: DateTime` | Separate persisted student-facing snapshot. Optional link to source record is unique; snapshot survives source-record deletion. |
| `attendance_corrections` | `id/attendanceRecordId/lecturerProfileId: UUID`, `originalStatus/correctedStatus/reason: String`, `createdAt: DateTime` | Append-only explanation of an attendance status correction. |
| `assessment_attendance` | `id/assessmentId/studentProfileId: UUID`, `status: String`, `recordedAt/createdAt: DateTime` | Assessment-level attendance, including examination attendance; `(assessmentId, studentProfileId)` unique. |
| `cat_submissions` | `id/assessmentId/studentProfileId: UUID`, `confirmedAt/verifiedAt: DateTime?`, `verifiedByLecturerId: UUID?`, `comments: String?`, timestamps | Separate student confirmation and lecturer verification; `(assessmentId, studentProfileId)` unique. |
| `attendance_discrepancies` | `id/studentProfileId: UUID`, `attendanceRecordId/assessmentAttendanceId/attendanceAttemptId/assignedLecturerProfileId: UUID?`, `description/status: String`, `resolution: String?`, timestamps | Dispute about a class record, assessment record, or rejected attempt. Service validation must ensure exactly one allowed target is linked. |
| `attendance_discrepancy_comments` | `id/discrepancyId/authorUserId: UUID`, `body: String`, `createdAt: DateTime` | Append-only discussion for an attendance discrepancy. |
| `attendance_excuse_requests` | `id/attendanceRecordId/studentProfileId: UUID`, `reviewedByLecturerId: UUID?`, `reason/status: String`, `decisionReason: String?`, `reviewedAt: DateTime?`, timestamps | Student request to excuse an attendance record and lecturer review outcome. |

### Shared operations

| Table | Columns (Prisma field: type) | Purpose |
|---|---|---|
| `notifications` | `id/userId: UUID`, `reportId: UUID?`, `title/message: String`, `readAt: DateTime?`, `createdAt: DateTime` | In-app notification for a user, optionally linked to a report. |
| `audit_logs` | `id: UUID`, `actorId: UUID?`, `action/entityType: String`, `entityId: String?`, `metadata: Json?`, `createdAt: DateTime` | Actor-attributed audit event. Entity reference is polymorphic (not a foreign key); do not put passwords, tokens or unnecessary private data in metadata. |
| `system_settings` | `key: String`, `value: Json`, `description: String?`, `updatedByUserId: UUID?`, `updatedAt: DateTime` | Configurable settings; key is the primary key. Validate each setting's expected shape in application code. |

## 11. Relationship map

Cardinality notation: `1 -> many` means the referenced parent can have many child rows; each child has one parent unless noted optional.

- `User 1 -> 0..1 StudentProfile`; `User 1 -> 0..1 LecturerProfile`.
- `User many <-> many Role` through `UserRole`.
- `User many <-> many Department` through `DepartmentMembership`.
- `Department 1 -> many CourseUnit`.
- `CourseUnit 1 -> many Assessment`, `UnitEnrollment`, `CourseUnitLecturer`, `MissingMarkReport`, and `AttendanceSession`.
- `StudentProfile 1 -> many UnitEnrollment`, `MissingMarkReport`, `Appeal`, `AttendanceRecord`, `AttendanceHistory`, `AttendanceAttempt`, `AssessmentAttendance`, `CatSubmission`, `AttendanceDiscrepancy`, and `AttendanceExcuseRequest`.
- `AcademicPeriod 1 -> many UnitEnrollment` and `MissingMarkReport`.
- `LecturerProfile 1 -> many CourseUnitLecturer`, assigned reports, attendance sessions, verified CAT submissions, attendance corrections, assigned discrepancies, excuse reviews, and proposed mark corrections.
- `Assessment 1 -> many MissingMarkReport` (reports may have no assessment until policy is confirmed), attendance sessions, assessment-attendance rows, and CAT submissions.
- `MissingMarkReport 1 -> 0..1 Appeal`, comments, assignments, status-history rows, and evidence; `MissingMarkReport 1 -> many SpecialCase`.
- `MissingMarkReport 1 -> many ReportEligibility` evaluations and `MarkCorrection` proposals. Each evaluation may be associated with the user who triggered it; each correction has a lecturer proposer and optional reviewer.
- `AttendanceSession 1 -> many AttendanceAttempt` and `AttendanceRecord`; each attendance record has at most one `AttendanceHistory` snapshot and may have many corrections/discrepancies.
- `AttendanceRecord 1 -> many AttendanceExcuseRequest`; each request belongs to a student and may have a reviewing lecturer.
- `AttendanceAttempt 1 -> many AttendanceDiscrepancy` may be used to investigate a rejected attempt without treating it as an absence.
- `Classroom 1 -> many AttendanceSession`; a session may have no classroom configured.
- A discrepancy may reference a class `AttendanceRecord`, an `AssessmentAttendance`, or an `AttendanceAttempt`. At least one target must be set; service validation enforces this because Prisma cannot express the check constraint.
- `Assessment 1 -> many CatSubmission`; each CAT submission optionally references a verifying lecturer.
- `User 1 -> many Notification`, authored comments, assignment/status events, uploaded evidence, audit events, and settings updates.
- `AttendanceDiscrepancy 1 -> many AttendanceDiscrepancyComment`.

Important cross-field consistency checks cannot be expressed as ordinary Prisma foreign keys: for example, a report's assessment must belong to the same course unit, an appeal's student must own the report, and evidence linked to an appeal must belong to that same report. Enforce these in services and test them.

## 12. Unique constraints and indexes

The schema enforces unique user email, role name, student number, one profile per user, non-null lecturer staff number, non-null department code, provided academic-period code, unit code within department, role and department membership pairs, one student/unit/period enrollment, one lecturer/unit assignment, report reference, one appeal per report, one student/session attendance record, one student/assessment attendance row, one CAT submission per student/assessment, public-holiday date, assessment/category codes and names, notification/outbox dedupe keys, attendance session token hash, evidence storage key, and one history row per source attendance record. Special cases are not unique by report. Query indexes support report lists by student/lecturer/status, deadline queues, notifications by user/time, and audit/history lookups.

There is deliberately no partial unique index for “one active report” and no unique appeal-per-report constraint yet. Both depend on rules still marked open in the repository docs. When approved, add a migration and service-level concurrency-safe enforcement together.

## 13. Delete and retention behavior

Academic entities and audit-relevant children use restrictive foreign keys so deleting a parent cannot silently erase history. User-role links and notifications cascade with user deletion; optional notification-to-report, audit-actor, and setting-updater references become null when their parent is removed. Attendance history uses an optional source-record relation with `SetNull`, retaining its snapshot if the source row is removed. The team must confirm archival and retention policy before exposing destructive API operations.

## 14. Decisions still required

Do not silently treat these as finalized by the schema:

- Whether users may hold multiple roles and whether COD and Academic Officer are one role or distinct roles. Current `UserRole` supports multiple roles to keep the schema extensible.
- Academic year/semester/class-group representation and the official uniqueness convention for academic periods.
- Whether every report must reference an `Assessment` or whether `assessmentComponent` text is sufficient.
- Exact report, appeal, attendance, session, CAT submission, special-case and discrepancy status values and transitions.
- Final decision authority, student edit/withdraw conditions, appeal count/deadline, and active-report duplicate rule.
- Which attendance statuses count toward eligibility, authoritative attendance source, and retention/deletion policy.
- Whether location data beyond the configured classroom boundary/result should be retained. The schema does not store a student's raw GPS coordinates.
- File retention, maximum upload size/types, and access after case closure.

The redesign document supplied entity concepts and workflow relationships, but no ERD or database table definition. This Prisma schema makes the relationships explicit while leaving the policy questions above open for team approval.

## 15. Local commands

## Feature 5 schema and migration

Migration `20261104120000_feature5_workflows` adds `assessment_types`, `special_case_categories`, `public_holidays`, and `notification_outbox`; adds an optional designated COD to each department; and stores assessment type, assignment start/deadline, appeal decision/deadline, and special-case submitter/decision/deadline fields. It removes the one-case-per-report index and creates an appeal-per-report unique index. Historical special-case category strings are copied to inactive lookup rows and linked without fabricating submitters or decisions. `assessment_id` and existing evidence relationships are retained.

`backend/prisma/seed.js` idempotently seeds the seven assessment types and six approved active special-case categories. The migration has not been applied to any database during this implementation. Before applying it to a database containing legacy data, verify its PostgreSQL schema and that existing appeal rows do not violate the new one-appeal-per-report index.

Feature 5 deadlines are stored snapshots. Updating a public holiday does not recalculate them. Evidence storage remains provider-neutral: existing metadata relations are preserved, and the application does not persist uploaded bytes or expose `storageKey` values.

## Local commands

From `backend/`, after copying `.env.example` to `.env` and providing a local development `DATABASE_URL`:

```bash
npm install
npm run db:validate
npm run db:generate
npm run db:migrate:dev
```

The Prisma config and migration history are shared. Only the schema maintainer should create/resolve migrations for the shared branch. Never point `migrate dev` at production or an unapproved shared database.
