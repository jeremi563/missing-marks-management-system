# Business Workflows

## Student roster sign-in

1. The administrator imports each eligible student's registration number, full name, and institutional email into the authoritative roster after creating the corresponding department and course.
2. The student signs in with their registration number as both the identifier and temporary password. No student self-registration form is available.
3. On the first successful sign-in, the system verifies the roster/course match and atomically creates the student user (including the roster full name), role, login identifier, and profile, then links the roster entry.
4. The student must choose a new private password before accessing other authenticated features. The temporary password is no longer accepted after the change.
5. Later sign-ins use the selected password. Existing linked student accounts are not recreated.

## 1. Purpose

This document describes the proposed end-to-end flow for a missing-mark report and related processes. The exact statuses, decision authority, deadlines and academic rules must be confirmed before implementation.

The database stores current report status plus append-only status, assignment and comment history. It does not define the allowed state machine: services must enforce the transitions agreed in this document and the open-questions register.

## 2. Missing-mark report: proposed lifecycle

A report may follow this general sequence:

1. **Draft** — student is preparing a report; it has not yet entered the official review process.
2. **Submitted** — student submits the report for review.
3. **Under review / Assigned** — the case is visible to the authorised department and assigned to a lecturer or reviewer.
4. **Investigation** — the lecturer reviews relevant records and may request clarification.
5. **Lecturer decision recorded** — the lecturer records a decision and reason or recommends the next action.
6. **Departmental review** — the COD / Academic Officer reviews the case where required.
7. **Resolved / Rejected** — an authorised decision is recorded and communicated.
8. **Appeal submitted** — the student submits an appeal where the policy permits.
9. **Appeal review completed** — the authorised reviewer records the appeal outcome.

This is a conceptual flow, not a final enum list. The team must agree on exact states and allowed transitions. Do not allow arbitrary status changes from the client.

## Student course enrollment

1. The administrator creates departments, courses within departments, and course units within courses. Student numbers encode the department initials and two-digit course identifier as `LLCC/DDDDD/YY`; the department/course must exist and the admission year must be from `13` through the current year.
2. The administrator sets the enrollment opening and closing dates on an academic period. Enrollment remains closed unless both dates are configured and the current time falls inside the window. Students can browse units in their registered course, but can submit enrollment requests only during an open window.
3. During that window, the student chooses the academic period and one or more course units from the student's encoded department and course. The server validates the course boundary for requests and attendance check-in.
4. The system accepts a request only for a unit with an active, approved lecturer assignment and rejects duplicate, pending, approved, or already-enrolled combinations.
5. The assigned course lecturer(s) and the COD designated for that department receive a review notification. Each sees only requests within their assignment or department scope.
6. An assigned lecturer or designated COD can approve or reject multiple pending requests at once. Administrators can review enrolments but cannot create them directly. The first successful decision wins; subsequent decisions cannot overwrite it.
7. Approval creates the student's `UnitEnrollment` for the requested unit and period. The student is notified of the outcome.

The request is unique per student, course unit, and academic period. Rejected requests may be submitted again; pending and approved requests and existing enrollments cannot be duplicated.

## Lecturer multi-department teaching

1. During lecturer registration step 2, the lecturer selects all teaching departments and identifies one as the primary department.
2. The primary department's designated COD receives the pending lecturer application and approves or rejects the account.
3. Each other selected department is stored as a pending membership request. Its designated COD can decide it only after the primary COD approves the account; approval creates membership and rejection leaves the lecturer outside that department.
4. CODs see and decide requests only for departments they currently administer. The lecturer receives a notification of each additional-department decision.
5. Membership enables a COD to assign course units in that department. Student lists remain scoped to assigned course units and are grouped by course, even when the lecturer teaches across departments.

## Lecturer course-unit assignments

1. A designated COD assigns an administrator-created, course-associated unit to an active, approved lecturer who belongs to that unit's department. Administrators can review or remove a mapping but cannot create one.
2. The system determines the current academic year using a September-to-August boundary; the client cannot choose a year.
3. Each course unit may have at most one lecturer mapping per academic year. A mapping in a later academic year is a separate assignment.
4. Lecturer course-unit and assessment access is limited to current-year mappings. Enrollment reviews, student rosters, attendance, and report reassignment use the matching academic year.
5. Legacy duplicate mappings remain stored for history, but only the latest mapping is assigned a year; earlier duplicates remain unscoped and do not grant current access.

## System administrator and COD accounts

- An administrator may create a COD account and designate it to a selected department in the same transaction. Each department has at most one designated COD.
- An administrator may create another system-administrator account, but the system-wide maximum is two accounts, including inactive accounts. Both account creation and role promotion enforce the cap transactionally.

## 3. Student actions

- A student creates a report for the relevant unit, academic period and assessment component.
- The API validates that the student is authenticated and is entitled to report the selected academic record.
- The student submits the report.
- Current implementation: submission creates the report directly in `Submitted`; there is no draft flow yet. Duplicate submissions are allowed until the team agrees and documents a duplicate policy.
- The student can track the status and view permitted messages or decisions.
- Editing or withdrawal is allowed only in states approved by the team.
- An appeal is accepted only when the policy and report state allow it. The previously discussed rule is a maximum of one appeal per report; confirm and enforce it server-side.

## 4. Lecturer investigation

- A student report is assigned to the lecturer mapped to its course unit and academic year when submitted, and the lecturer receives an in-app notification. If no matching mapping exists, the report remains `Submitted` until an authorized assignment is made.
- The lecturer sees only reports within their assigned/authorised scope.
- Opening a report shows CAT and exam attendance for its course unit and academic year. Missing assessment attendance is `Unknown` unless a completed matching assessment session exists without a student check-in, which is shown as `Not present`.
- The lecturer also sees the student's completed class-session attendance percentage against the configured threshold (80% by default). This is advisory and does not block the lecturer's decision.
- The lecturer may send student-visible feedback on the report or request clarification.
- The lecturer records a decision or recommendation with a reason.
- Every significant action should identify the actor and timestamp and be recorded in the audit history.
- The lecturer cannot act on a report outside their permission scope.

## 5. COD / Academic Officer review

- The COD / Academic Officer receives reports only after a lecturer escalates them.
- Student submissions are routed to the lecturer mapped to the course unit and academic year; CODs do not assign or reassign these reports.
- Academic information review is read-only: the COD can inspect linked application enrollment, assessment, CAT submission, and assessment-attendance records supported by the report's relationships. This review does not create an approval/rejection outcome or change report status. These application records are not independently verified official university records; missing records do not prove an event did not occur.
- Report comments authored by a COD are staff-private and retained as append-only comments. Comment creation records an actor-attributed audit event transactionally with the comment.
- They review escalated lecturer decisions, appeals and special cases.
- Decisions must include the actor, timestamp and reason.
- The final authority for each case type must be agreed and documented.

### Feature 4: lecturer escalation and COD final decision

- A lecturer may escalate only a report assigned to their authenticated lecturer profile after recording `APPROVED` or `REJECTED`.
- Escalation changes the current status to `ESCALATED`, records the reason, appends status history and a `REPORT_ESCALATED` audit event, and notifies the designated COD transactionally.
- CODs list escalated reports through the department-scoped report listing and may review the original lecturer decision, escalation reason, report history, linked academic application records, report-scoped audit events and safe evidence metadata available for that report.
- A COD may make a final `APPROVE` or `REJECT` decision only while the report is `ESCALATED` and within the COD's authorized department membership. The final status history records actor, reason and time; the `COD_REPORT_DECISION_RECORDED` audit event is written in the same transaction.
- Status history preserves the lecturer decision, escalation and COD final decision as separate entries. Evidence files are not uploaded, viewed or retrieved by this workflow; only metadata may be returned, without `storageKey`, until a storage approach is agreed.
- Existing separate issue: student submission creates `Submitted`, while the lecturer decision endpoint expects `PENDING`; no transition was identified. Student and lecturer decision behavior is unchanged by Feature 4.

## 6. Attendance-related workflow

Lecturers create attendance sessions for assigned course units with a required start and end time, start the session, then share its QR code or link with students. Students scan/open it while signed in and request a location check-in. The server verifies the token, active session window, course-unit enrollment for the session academic year and the reported distance from the configured classroom coordinates; only an in-boundary check-in creates the attendance record and history row. The backend periodically marks scheduled/active sessions completed when their end time passes, invalidating the check-in token; check-in itself is denied at the end time without waiting for that periodic update. A lecturer can end an active session early or extend its end time to a later future time while it is still active. Generating a replacement link for an active session invalidates the previous one. Coordinates are not persisted; device-reported GPS is not tamper-proof and should not be treated as a guarantee against location spoofing.

Attendance records, assessment-attendance rows and attendance attempts remain distinct sources. Attempts record rejected check-in outcomes and are not confirmation of attendance. Departmental COD reporting scopes each source through its course unit and does not infer absences from missing rows.

Students may submit a discrepancy only for their own attendance source. A student-submitted discrepancy waits for the assigned lecturer to review it. The lecturer records a rejection with an explanation or forwards it to COD. A lecturer may submit a discrepancy for an attendance source in a course unit to which they are assigned; lecturer submissions enter COD review directly. The original reporter answers a COD clarification request through a discrepancy comment linked to that exact request. A response to an older request does not satisfy a newer request.

There may be only one active discrepancy per student and source, regardless of whether a student or lecturer submitted it. Active states are `PENDING_LECTURER_REVIEW`, `PENDING_COD_REVIEW`, `CLARIFICATION_REQUESTED`, `CORRECTION_RECOMMENDED` and `CORRECTION_AUTHORIZED`; the last remains active while awaiting Admin application. `CONFIRMED`, `REJECTED`, `LECTURER_REJECTED` and `CORRECTION_APPLIED` are terminal. After a terminal state, a new discrepancy may be filed for that source. Each clarification decision accepts at most one response from its original reporter.

COD decisions are append-only and department-scoped. `RECOMMEND_CORRECTION` may follow an eligible COD review state; `AUTHORIZE_ATTENDANCE_CORRECTION` may follow only `CORRECTION_RECOMMENDED`. COD authorization records an audit decision and the source status at authorization. It does not change attendance.

Legacy correction authorizations without a recorded source-status snapshot require a separate revalidation by the currently designated, active departmental COD. Revalidation verifies the original authorization and provenance, confirms the discrepancy still references its owned session attendance record, captures its current eligible status in a new append-only decision linked to the original authorization, and does not modify attendance. Admin correction must use this fresh decision and rechecks the captured status before applying; the legacy authorization alone is rejected.

An authenticated Admin applies an authorized correction for a session `AttendanceRecord` through a separate transaction. The operation verifies the COD authorization and unchanged source status, updates the current record, stores original and corrected status, reason, administrator and timestamp in `AttendanceCorrection`, marks the discrepancy applied and writes an audit event. The linked `AttendanceHistory` snapshot remains unchanged. Assessment-attendance and attempt corrections are unsupported by the current correction model and are rejected; they require a separate approved schema/workflow design.

The attendance percentage uses the administrator-configurable threshold, which defaults to 80%, as advisory context for lecturer report review. The official university source of truth for attendance remains a separate open decision. Attendance data must not be fabricated or silently changed.

## 7. CAT and examination attendance

Assessment-attendance and attempt sources can be reviewed in departmental reports and discrepancies. The current Admin correction ledger supports session attendance records only. Confirm the official university source of truth for CAT and examination attendance before treating application records as authoritative.

The team has discussed QR verification for an exam booklet. Document the final scanning, matching and exception process before implementation.

## 8. Notifications

Notifications may be triggered when:

- A report is submitted.
- A report is assigned or reassigned.
- A lecturer requests clarification.
- A decision is recorded.
- A report is escalated or becomes overdue.
- An appeal is submitted or decided.

Notifications should not disclose private academic information to an unauthorised recipient. A notification is an alert; the API must still enforce permissions when the user opens the underlying record.

Students receive report progress notifications, and lecturers are notified when reports are auto-assigned on submission or manually assigned/reassigned by a COD. New student submissions are routed to the mapped lecturer first and do not notify the COD. Lecturer and COD notification inboxes support unread/read filters, individual read updates, and an atomic mark-all-as-read action. All staff notification operations are scoped to the authenticated user.

## 9. Audit history

Record important events such as:

- Report creation and submission.
- Assignment and reassignment.
- Clarification requests and responses.
- Approval, rejection and appeal decisions.
- Attendance record creation or authorised correction.
- Administrative changes to accounts, roles or configuration.

Agree on the exact audit fields and retention policy. Avoid storing passwords, tokens or unnecessary sensitive content in audit logs.

## 10. Workflow decisions to finalise

| Decision | Owner / agreed outcome | Status |
|---|---|---|
| Exact report status list and transitions |  | Open |
| Which lecturer decisions require COD review |  | Open |
| Final decision authority by case type |  | Open |
| Student edit and withdrawal conditions |  | Open |
| Appeal eligibility, deadline and one-appeal rule | Feature 5 implementation | Implemented |
| Attendance threshold and calculation |  | Open |
| QR/link/location verification rules |  | Open |
| CAT and examination attendance source of truth |  | Open |
| Overdue definition and review deadline | Feature 5 implementation | Implemented |

## Feature 5 implemented workflow

1. A report is assigned to the lecturer mapped to its course unit and academic year on submission. The lecturer explicitly starts work; the timestamp and stored deadline are recorded on the assignment.
2. The lecturer submits exactly one final decision with an active assessment type. `Other` requires an explanation. Viewing a report does not start the deadline.
4. A student may appeal only their own currently `REJECTED` report, within 14 calendar days of the rejection status-history timestamp, and at most once. A designated departmental COD decides once with a reason. Approval returns the report to `PENDING` and appends status history; rejection leaves it `REJECTED`.
5. A student may submit a special case for their own eligible report; a lecturer may submit for a report currently assigned to them. Active categories are database-managed. Multiple cases per report are independent. A designated departmental COD decides each case once with a reason; this does not alter report status.
6. Lecturer and COD case-review deadlines are persisted when the work becomes available/starts. Overdue means unresolved and current time strictly greater than the stored deadline. Holiday-calendar corrections do not silently recalculate existing deadlines. COD report alerts are generated on escalation only.
7. Overdue notifications for lecturer work, appeals and special cases are queued in PostgreSQL and delivered by a separate worker. Start the API with `npm start` and a worker separately with `npm run worker:notifications` from `backend/`.

Working-day dates are evaluated in `Africa/Nairobi`, skip Saturdays, Sundays, and dates recorded in `PublicHoliday`. Holiday records require administrator access. Exactly-at-deadline decisions are on time.

The attendance eligibility threshold defaults to 80% and may be changed through the administrator settings API. The student appeal window defaults to 14 calendar days and may be changed through the same API. Existing appeal and review deadline snapshots are not recalculated after a setting change. Overdue notification queuing is enabled by default and may be disabled by an administrator; failed notification delivery uses a configurable retry limit that defaults to five attempts.

The schema retains provider-neutral evidence metadata relationships and API-level validation rules. Actual private file upload and download are pending selection of a storage provider; no storage key is exposed.
| Audit and record retention requirements |  | Open |
