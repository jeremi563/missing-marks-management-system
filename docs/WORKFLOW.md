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

The project discussions have included attendance sessions created by lecturers and attendance records associated with students. A QR code or link and location validation have been considered.

Before implementation, confirm:

- Who may create an attendance session.
- How a session is associated with a unit, class and time window.
- How a student is authenticated before recording attendance.
- Whether QR, link, location or a combination is required.
- How duplicate attendance submissions are prevented.
- How corrections and disputes are handled.
- How the agreed attendance threshold is calculated and which records count.

The previously discussed 80% attendance threshold should be treated as a proposed project rule until confirmed. Attendance data must not be fabricated or silently changed.

## 7. CAT and examination attendance

The project scope includes CAT confirmation and examination attendance-related checks. Confirm the source of truth for these records, which role may view them, how they relate to a missing-mark case and what action is permitted when a discrepancy is found.

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
| Appeal eligibility, deadline and one-appeal rule |  | Open |
| Attendance threshold and calculation |  | Open |
| QR/link/location verification rules |  | Open |
| CAT and examination attendance source of truth |  | Open |
| Overdue definition and escalation period |  | Open |
| Audit and record retention requirements |  | Open |
