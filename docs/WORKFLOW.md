# Business Workflows

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

## 3. Student actions

- A student creates a report for the relevant unit, academic period and assessment component.
- The API validates that the student is authenticated and is entitled to report the selected academic record.
- The student submits the report.
- Current implementation: submission creates the report directly in `Submitted`; there is no draft flow yet. Duplicate submissions are allowed until the team agrees and documents a duplicate policy.
- The student can track the status and view permitted messages or decisions.
- Editing or withdrawal is allowed only in states approved by the team.
- An appeal is accepted only when the policy and report state allow it. The previously discussed rule is a maximum of one appeal per report; confirm and enforce it server-side.

## 4. Lecturer investigation

- The lecturer sees only reports within their assigned/authorised scope.
- The lecturer reviews the submitted information and relevant academic/attendance records.
- The lecturer may add an investigation comment or request clarification.
- The lecturer records a decision or recommendation with a reason.
- Every significant action should identify the actor and timestamp and be recorded in the audit history.
- The lecturer cannot act on a report outside their permission scope.

## 5. COD / Academic Officer review

- The COD / Academic Officer sees reports within the authorised department or academic scope.
- They may assign or reassign a case where permitted.
- Academic information review is read-only: the COD can inspect linked application enrollment, assessment, CAT submission, and assessment-attendance records supported by the report's relationships. This review does not create an approval/rejection outcome or change report status. These application records are not independently verified official university records; missing records do not prove an event did not occur.
- Report comments authored by a COD are staff-private and retained as append-only comments. Comment creation records an actor-attributed audit event transactionally with the comment.
- They review lecturer actions, escalations, overdue cases, appeals and special cases.
- Decisions must include the actor, timestamp and reason.
- The final authority for each case type must be agreed and documented.

### Feature 4: lecturer escalation and COD final decision

- A lecturer may escalate only a report assigned to their authenticated lecturer profile after recording `APPROVED` or `REJECTED`.
- Escalation changes the current status to `ESCALATED`, records the reason, and appends status history and a `REPORT_ESCALATED` audit event transactionally.
- CODs list escalated reports through the department-scoped report listing and may review the original lecturer decision, escalation reason, report history, linked academic application records, report-scoped audit events and safe evidence metadata available for that report.
- A COD may make a final `APPROVE` or `REJECT` decision only while the report is `ESCALATED` and within the COD's authorized department membership. The final status history records actor, reason and time; the `COD_REPORT_DECISION_RECORDED` audit event is written in the same transaction.
- Status history preserves the lecturer decision, escalation and COD final decision as separate entries. Evidence files are not uploaded, viewed or retrieved by this workflow; only metadata may be returned, without `storageKey`, until a storage approach is agreed.
- Existing separate issue: student submission creates `Submitted`, while the lecturer decision endpoint expects `PENDING`; no transition was identified. Student and lecturer decision behavior is unchanged by Feature 4.

## 6. Attendance-related workflow

Lecturers create and manage attendance sessions for assigned course units. Attendance records, assessment-attendance rows and attendance attempts remain distinct sources. Attempts record submission outcomes and are not confirmation of attendance. Departmental COD reporting scopes each source through its course unit and does not infer absences from missing rows.

Students may submit a discrepancy only for their own attendance source. A student-submitted discrepancy waits for the assigned lecturer to review it. The lecturer records a rejection with an explanation or forwards it to COD. A lecturer may submit a discrepancy for an attendance source in a course unit to which they are assigned; lecturer submissions enter COD review directly. The original reporter answers a COD clarification request through a discrepancy comment linked to that exact request. A response to an older request does not satisfy a newer request.

There may be only one active discrepancy per student and source, regardless of whether a student or lecturer submitted it. Active states are `PENDING_LECTURER_REVIEW`, `PENDING_COD_REVIEW`, `CLARIFICATION_REQUESTED`, `CORRECTION_RECOMMENDED` and `CORRECTION_AUTHORIZED`; the last remains active while awaiting Admin application. `CONFIRMED`, `REJECTED`, `LECTURER_REJECTED` and `CORRECTION_APPLIED` are terminal. After a terminal state, a new discrepancy may be filed for that source. Each clarification decision accepts at most one response from its original reporter.

COD decisions are append-only and department-scoped. `RECOMMEND_CORRECTION` may follow an eligible COD review state; `AUTHORIZE_ATTENDANCE_CORRECTION` may follow only `CORRECTION_RECOMMENDED`. COD authorization records an audit decision and the source status at authorization. It does not change attendance.

Legacy correction authorizations without a recorded source-status snapshot require a separate revalidation by the currently designated, active departmental COD. Revalidation verifies the original authorization and provenance, confirms the discrepancy still references its owned session attendance record, captures its current eligible status in a new append-only decision linked to the original authorization, and does not modify attendance. Admin correction must use this fresh decision and rechecks the captured status before applying; the legacy authorization alone is rejected.

An authenticated Admin applies an authorized correction for a session `AttendanceRecord` through a separate transaction. The operation verifies the COD authorization and unchanged source status, updates the current record, stores original and corrected status, reason, administrator and timestamp in `AttendanceCorrection`, marks the discrepancy applied and writes an audit event. The linked `AttendanceHistory` snapshot remains unchanged. Assessment-attendance and attempt corrections are unsupported by the current correction model and are rejected; they require a separate approved schema/workflow design.

The previously discussed 80% attendance threshold remains a proposed project rule until confirmed. QR, link and location verification details and the official university source of truth remain separate open decisions. Attendance data must not be fabricated or silently changed.

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

1. A COD assigns a `Submitted` report transactionally. The report becomes `PENDING`, with status history, assignment history, and audit record. Reassignment appends assignment history and does not reset a work deadline.
2. The currently assigned lecturer explicitly starts work. The timestamp and stored deadline are recorded on the current assignment; the deadline is seven working days later, preserving the Nairobi local clock time.
3. The lecturer submits exactly one final decision with an active assessment type. `Other` requires an explanation. Viewing a report does not start the deadline.
4. A student may appeal only their own currently `REJECTED` report, within 14 calendar days of the rejection status-history timestamp, and at most once. A designated departmental COD decides once with a reason. Approval returns the report to `PENDING` and appends status history; rejection leaves it `REJECTED`.
5. A student may submit a special case for their own eligible report; a lecturer may submit for a report currently assigned to them. Active categories are database-managed. Multiple cases per report are independent. A designated departmental COD decides each case once with a reason; this does not alter report status.
6. COD-review and lecturer deadlines are persisted when the work becomes available/starts. Overdue means unresolved and current time strictly greater than the stored deadline. Holiday-calendar corrections do not silently recalculate existing deadlines.
7. Overdue notifications are queued in PostgreSQL and delivered by a separate worker. Start the API with `npm start` and a worker separately with `npm run worker:notifications` from `backend/`.

Working-day dates are evaluated in `Africa/Nairobi`, skip Saturdays, Sundays, and dates recorded in `PublicHoliday`. Holiday records require administrator access. Exactly-at-deadline decisions are on time.

The attendance eligibility threshold defaults to 80% and may be changed through the administrator settings API. The student appeal window defaults to 14 calendar days and may be changed through the same API. Existing appeal and review deadline snapshots are not recalculated after a setting change. Overdue notification queuing is enabled by default and may be disabled by an administrator; failed notification delivery uses a configurable retry limit that defaults to five attempts.

The schema retains provider-neutral evidence metadata relationships and API-level validation rules. Actual private file upload and download are pending selection of a storage provider; no storage key is exposed.
| Audit and record retention requirements |  | Open |
