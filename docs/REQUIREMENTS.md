# Requirements and Scope

## 1. Purpose

The Missing Marks Management System is intended to provide a structured process for reporting, investigating, reviewing and tracking missing-mark cases. It supports students, lecturers, CODs / Academic Officers and system administrators.

This document describes the initial functional scope for development. It is not a substitute for formal university policy. Where a rule is uncertain, record it as an open question and obtain team/stakeholder agreement before implementation.

The implemented database tables and their relationships are documented in [DATABASE.md](DATABASE.md). Its flexible status fields and optional relations intentionally preserve the open decisions listed below; do not infer policy from a database default.

## 2. Project objectives

- Provide a consistent way for students to report missing marks.
- Make report ownership, status and decisions visible to authorised users.
- Help lecturers investigate reports assigned to them.
- Enable departmental oversight, escalation and appeal handling.
- Support administration of accounts and academic structures.
- Keep an auditable history of important actions.

## 3. User roles and responsibilities

### 3.1 Student

A student should be able to:

- View their own profile and relevant academic information.
- Create and submit a missing-mark report.
- View the reports they submitted and track each report's status.
- View a report's details and permitted discussion or clarification requests.
- Edit or withdraw a report only when its status and system rules permit.
- Submit an appeal where permitted by the agreed appeal policy.
- View their own attendance history and relevant attendance-related information.
- Receive notifications about report progress and required action.

A student must not view another student's private report or change official marks.

### 3.2 Lecturer

A lecturer should be able to:

- View reports assigned to them and relevant report details.
- Investigate a case and add comments or request clarification.
- Record an approval or rejection with a reason, where authorised.
- Propose a correction or next action through the agreed workflow.
- Create and manage attendance sessions for their assigned classes/units, subject to the approved attendance rules.
- Review relevant CAT and examination attendance information.
- View only the students, units and records they are authorised to access.

A lecturer must not access unrelated departmental or system administration functions.

### 3.3 COD / Academic Officer

A COD / Academic Officer should be able to:

- View reports within the authorised department or academic scope.
- Assign or reassign cases to lecturers where permitted.
- Monitor case progress and identify overdue or escalated cases.
- Review lecturer decisions.
- Handle appeals and special cases under the agreed approval process.
- Record departmental decisions and reasons.
- View relevant departmental summaries and audit information.

The exact distinction between COD and Academic Officer permissions must be confirmed. If they are separate real-world roles, the team must decide whether they share a system role or have distinct permissions.

### 3.4 Administrator

An administrator should be able to:

- Create, update, deactivate and manage user accounts.
- Assign system roles according to the agreed access policy.
- Manage departments, courses/units, enrolments and lecturer-to-unit mappings.
- Configure system settings, deadlines and operational parameters.
- View system-wide statistics, permitted exports, audit logs and archives.
- Perform approved maintenance or reopening actions.

System administration does not automatically grant authority to alter official academic marks. Mark decisions must follow the authorised academic workflow.

## 4. Functional areas

1. Authentication and access control.
2. User profiles and academic relationships.
3. Missing-mark report submission and tracking.
4. Lecturer investigation and decision recording.
5. Attendance session creation and attendance verification.
6. CAT and examination attendance-related checks.
7. COD / Academic Officer review, assignment and escalation.
8. Appeals and special-case handling.
9. Notifications.
10. Administration, audit and reporting.

## 5. Important business rules to confirm

The following are project rules previously discussed or proposed. Confirm their exact interpretation with the team and relevant stakeholders before coding:

- A student may submit at most one appeal for a report.
- Attendance eligibility is based on an 80% attendance threshold, if this remains the approved project rule.
- CAT and examination attendance are relevant evidence in the workflow.
- Attendance may be captured through a QR code or link, with location validation where approved.
- The exam booklet may use a QR code for the agreed verification process.
- General evidence uploads are not part of the default workflow unless the team approves a specific special-case requirement.
- Define who can approve, reject, reopen or escalate a report.
- Define whether a report can be edited or withdrawn after submission or assignment.
- Define deadlines, overdue calculations and notification triggers.

Do not hard-code an uncertain rule. Keep configurable values in one agreed place where appropriate.

## 6. Non-functional requirements

- **Security:** enforce authentication, role-based access and ownership checks on the backend.
- **Privacy:** expose only the records a user is authorised to access.
- **Integrity:** validate state transitions and preserve an audit trail of important decisions.
- **Reliability:** handle expected errors consistently and avoid silent data loss.
- **Maintainability:** use clear modules, shared services and consistent naming.
- **Testability:** write tests for business rules, permissions and workflow transitions.
- **Usability:** provide clear statuses, validation feedback and next steps.
- **Performance:** use appropriate database queries and pagination for growing lists.

## 7. Out of scope unless approved

- Direct editing of official marks by an administrator.
- Unrestricted access to all student records by every staff role.
- Separate databases or separate backend applications for each role.
- Unapproved integrations with university systems.
- Use of real student data in local development or public demonstrations.

## 8. Open questions register

Record decisions here as the team confirms them.

| Question | Decision / owner | Status |
|---|---|---|
| Are COD and Academic Officer one system role or separate roles? |  | Open |
| What exact statuses can a missing-mark report have? |  | Open |
| Who makes the final decision for each report type? |  | Open |
| At what stage can a student edit or withdraw a report? |  | Open |
| What is the authoritative source for attendance eligibility? |  | Open |
| What are the deadlines and escalation periods? |  | Open |
| What evidence can be attached, and who can view it? |  | Open |
| What is the exact appeal policy and one-appeal rule? |  | Open |