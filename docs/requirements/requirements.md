# Requirements — Missing Marks Management System

**Project:** A Web-Based Application for Reporting and Tracking Missing Marks — Case Study of Kisii University
**Status:** Baseline derived from the project requirements document and `docs/design/system-design.txt`. Changes go through a GitHub Issue → team review → meeting notes → this file.
**Data policy:** Local/mock academic data only. No live university integration. The system never modifies official university marks or registers.

---

## 1. Purpose

Replace informal missing-mark follow-up (calls, WhatsApp, visits) with one controlled, auditable workflow: students report, lecturers investigate, CODs decide, students may appeal once, and every step is traceable. The system also keeps its own class, CAT and examination attendance records to support the eligibility check.

## 2. Scope

### 2.1 In scope (full project)
Accounts & roles · missing-mark lifecycle (submit, review, decide, appeal, close, reopen) · academic structure (mock) · class attendance via link/QR with location check · attendance history & discrepancies · CAT attendance and submission confirm/verify · examination QR attendance · eligibility classification (Normal/Special) · special-case evidence upload · in-app + (mock) email notifications · overdue detection · search/filter/pagination · PDF/Excel exports · audit trail · admin settings, maintenance mode, archive access.

### 2.2 Out of scope (initial release)
Live university integration · modifying official results/registers · SMS · AI decisions · payments · native mobile app · real-time updates · cloud/object storage · automated backups · routine attendance-evidence or booklet uploads · support-ticket system · advanced analytics.

### 2.3 Delivery phases

| Phase | Name | Content | Release |
|---|---|---|---|
| **1** | **MVP — Case lifecycle** | Foundation, auth, RBAC, academic structure (seeded), report submit/track/withdraw, lecturer review & decision, COD review & closure, one appeal, status history, comments, audit log, in-app notifications (+ mock email), basic search/pagination, eligibility *stub* | `v0.1.0` |
| **2** | Attendance | Password reset, classrooms, class sessions with link/QR, location check, attendance records + history, discrepancies & corrections | `v0.2.0` |
| **3** | Assessments & eligibility | Assessments, CAT attendance + submission confirm/verify, exam QR attendance, special-case evidence upload, real eligibility engine, report drafts | `v0.3.0` |
| **4** | Admin & polish | Overdue job, system settings, maintenance mode, archive & reopen, history deletion, PDF/Excel exports, admin 2FA (if time), OpenAPI/Postman final, security review | `v0.4.0` → `v1.0.0` |

> If time runs short, protect Phase 1 + Phase 2 + the eligibility engine first; exports and 2FA are the first to slip.

---

## 3. Roles and permission summary

| Role | Summary |
|---|---|
| **Student** | Owns their reports and attendance data; submits, edits/withdraws (Pending only), appeals once, confirms CAT submission, scans exam QR |
| **Lecturer** | Works on cases assigned to them and units they teach; reviews, comments, approves/rejects (reason mandatory), proposes marks; manages attendance/CAT sessions and discrepancies |
| **COD / Academic Officer** | Department oversight; assigns/reassigns within department; reviews lecturer-approved cases, appeals, escalated discrepancies; records final decisions |
| **Administrator** | System-wide accounts, structure, settings, audit, reassignments, reopening, archive access, history deletion. **Cannot modify official marks** |

### Permission matrix (key actions)

| Action | Student | Lecturer | COD | Admin |
|---|:--:|:--:|:--:|:--:|
| Register / log in | ✔ | ✔ (account provisioned) | ✔ (provisioned) | ✔ (provisioned) |
| Submit report | ✔ (own) | – | – | – |
| Edit / withdraw report | ✔ own, **Pending only** | – | – | – |
| View report | own | assigned / own units | own department | all |
| Start review, comment, approve/reject at lecturer level | – | ✔ assigned | – | – |
| Reassign report | – | – | ✔ dept | ✔ |
| COD review, final decision | – | – | ✔ dept | – |
| Submit appeal (once per case) | ✔ own | – | – | – |
| Reopen closed case (reason required) | – | – | – | ✔ |
| Manage users / departments / units / enrollments / assignments | – | – | – | ✔ |
| View audit log | – | – | dept-relevant | ✔ |
| View attendance history | own | assigned units | dept | all |
| Delete attendance-history entry | ✘ | ✘ | ✘ | ✔ (audited) |
| Change system settings / maintenance mode | – | – | – | ✔ |

**Authorization principle:** hiding a button is not security. Each API operation independently checks identity, role, ownership/department/assignment, enrollment, session validity and record state.

---

## 4. Functional requirements

Phase = when it is built. FR numbers come from the requirements document; FR28 was added for traceability of the eligibility engine.

| ID | Requirement | Phase |
|---|---|:--:|
| FR1 | Authenticate users according to role (JWT in HttpOnly cookies, bcrypt) | 1 |
| FR2 | Eligible students create accounts using university registration details (checked against mock registry) | 1 |
| FR3 | Students submit missing-mark reports (unique reference `MMR-YYYY-NNNNNN`, duplicate check, auto-assignment) | 1 |
| FR4 | Incomplete reports saved as drafts; resume; abandoned drafts expire | 3 |
| FR5 | Students track case status, history, comments, decisions, appeal state | 1 |
| FR6 | Lecturers investigate assigned reports; comment; approve/reject (reason mandatory); propose mark ≤ assessment maximum | 1 |
| FR7 | CODs review departmental reports, reassign, decide, close | 1 |
| FR8 | One appeal per case; reason mandatory; routed to COD | 1 |
| FR9 | Class attendance via link/QR: authentication, enrollment check, session validity, duplicate prevention, classroom location check | 2 |
| FR10 | CAT attendance sessions via link/QR | 3 |
| FR11 | Exam attendance by scanning booklet QR; recorded only after server validation | 3 |
| FR12 | Student confirms CAT submission; lecturer verifies — separate records | 3 |
| FR13 | Special circumstances with permitted evidence upload (PDF/JPG/JPEG/PNG, configurable size) | 3 |
| FR14 | In-app notifications and email through a provider abstraction (mock/log in development) | 1 (in-app, mock email) |
| FR15 | Role-scoped search, filtering, server-side pagination | 1 (reports) / 2+ (rest) |
| FR16 | PDF and Excel exports, role-scoped | 4 |
| FR17 | Append-only audit trail for important actions | 1 |
| FR18 | Administrator management: users, departments, units, enrollments, assignments, settings | 1 (basic) / 4 |
| FR19 | Attendance discrepancies: student reports, lecturer investigates/corrects (audited), escalation to COD | 2 |
| FR20 | Assessment configuration; required CATs per unit | 3 |
| FR21 | Configurable lecturer (3 working days) and COD (5 working days) deadlines; overdue flag | 4 |
| FR22 | Secure authentication, authorization, lockout (5 attempts / 30 min, configurable) | 1 |
| FR23 | Attendance history entries, role-scoped, admin-only permanent deletion | 2 |
| FR24 | Classroom location and boundary configuration | 2 |
| FR25 | Reject attempts on closed/expired sessions; prevent duplicate successful records | 2 |
| FR26 | Controlled review of special-case evidence; no attendance-evidence uploads | 3 |
| FR27 | CAT confirmation and lecturer verification stored as separate events | 3 |
| FR28 | Eligibility engine: ≥80% class attendance + required CATs + confirmed exam attendance → Normal, otherwise Special; advisory only | stub in 1, full in 3 |

---

## 5. Non-functional requirements

| Area | Requirement |
|---|---|
| Security | Backend-enforced RBAC and scope; bcrypt; HttpOnly/Secure cookies; Zod validation; rate limiting; safe errors; no secrets in Git |
| Integrity | Valid status transitions only; duplicate-prevention enforced in service **and** database; transactions for report+audit+notification |
| Auditability | Actor, time, action, entity, reason, previous/new values for important actions |
| Privacy | Role-scoped queries; minimal retention of location data; no precise coordinates exposed to ordinary users |
| Performance | Database-side filtering, server-side pagination, indexes on filter columns |
| Maintainability | Modular monolith; routes → controllers → services → Prisma; shared contracts |
| Usability | Responsive web; clear statuses, reasons and validation messages |
| Configurability | Thresholds, deadlines, lockout, upload limits are settings, not hard-coded |
| Extensibility | Provider abstractions (email, storage) so future integration doesn't redesign the core |

---

## 6. Business rules

Referenced in code, tests and reviews as **BR-xx**.

**Reports and workflow**
- **BR-01** One *active* report per student/unit/assessment. Active = not withdrawn and not Closed.
- **BR-02** A new report is allowed after the previous one is Closed or withdrawn.
- **BR-03** Students may edit or withdraw only while status is **Pending**.
- **BR-04** Original report content is locked when the lecturer starts review.
- **BR-05** Lecturer rejection requires a reason.
- **BR-06** One appeal per case; appeal reason mandatory; second appeal blocked.
- **BR-07** Lecturer comments are editable until COD review starts; afterwards immutable (new comments still allowed).
- **BR-08** The final COD decision is locked when the case is Closed.
- **BR-09** A proposed/entered mark may not exceed the assessment maximum; lecturer marks need COD approval; official results are never modified.
- **BR-10** Overdue is a flag, not a status.
- **BR-11** If no lecturer mapping exists, the case enters an assignment queue — never invent a lecturer.
- **BR-12** Reassignment records old/new assignee, actor, time, reason.
- **BR-13** Only an administrator may reopen a Closed case, with a reason.
- **BR-14** A valid notification email must exist before a student's first submission; it need not be the university email.
- **BR-15** Eligibility classification is advisory; the system never decides special-circumstance validity.

**Attendance and assessments (Phases 2–3)**
- **BR-20** Only authenticated, enrolled students can record attendance; link/QR do not bypass auth.
- **BR-21** One successful attendance record per student/session (database constraint + service check).
- **BR-22** Closed/expired sessions reject attempts.
- **BR-23** A failed location check rejects the attempt; it does **not** mark the student absent.
- **BR-24** The backend writes attendance; the history entry is created only after server confirmation.
- **BR-25** Lecturer corrections require a reason and an audit event; history is never silently overwritten.
- **BR-26** Students see only their own history; lecturers/CODs are scope-limited; only admins delete history (audited).
- **BR-27** CAT attendance, student submission confirmation and lecturer verification are separate records; either of attendance/submission may happen first.
- **BR-28** Only CAT status **Present** satisfies normal eligibility; Late/Excused/Absent do not (unless configured).
- **BR-29** Required CATs are configured per unit.
- **BR-30** Exam attendance counts only after server-side QR validation; QR content exposes no student data.
- **BR-31** Uploads are allowed only for special-case evidence (PDF/JPG/JPEG/PNG, size configurable); none for attendance or booklets.

**Accounts and platform**
- **BR-40** Password: ≥8 chars with upper, lower, number, special character; stored with bcrypt.
- **BR-41** 5 consecutive failures lock the account for 30 minutes (configurable); success resets the counter.
- **BR-42** Deactivated users cannot log in; their records are retained.
- **BR-43** Archived records are read-only; admin access requires a reason.
- **BR-44** Authorization is enforced by the backend for every protected operation.

---

## 7. MVP (Phase 1) definition

**Goal:** prove the architecture with one complete, secure, demoable lifecycle on mock data.

**MVP user journey (acceptance):**
1. Seeded student logs in and submits a missing-mark report for an enrolled unit.
2. Duplicate submission for the same student/unit/assessment is rejected.
3. Report is auto-assigned to the mapped lecturer; student gets an in-app notification.
4. Lecturer starts review (report content locks), comments, and approves.
5. COD starts review and records the final decision → case Closed; student notified.
6. Alternative path: lecturer rejects with reason → student appeals once → COD decides → Closed. Second appeal is blocked.
7. Student can withdraw while Pending and resubmit.
8. Every step is visible in the report's status history and in the admin audit log.
9. A student cannot read another student's report; a lecturer cannot read unassigned reports; a COD cannot read another department (IDOR tests).

**MVP includes:** auth (register/login/logout/refresh/me, lockout), RBAC + scope helpers, departments/units/enrollments/lecturer-assignments (admin create + list, seeded), reports + comments + decisions + appeals + status history, audit service + admin audit-log list, notification service (in-app + mock email), role-scoped list with filters and pagination, eligibility service stub (returns "not evaluated"), standard envelope/error handling, Zod validation, automated tests, Postman collection.

**MVP excludes:** drafts, password reset, attendance, CAT, exams, evidence uploads, exports, overdue job, settings UI, maintenance mode, archive/reopen, 2FA, frontend (frontend starts once the MVP API is stable).

---

## 8. Assumptions and constraints

- Four-person team; roughly eight weeks overall; all four contribute to the backend first.
- Working-day calculation uses weekdays unless a holiday calendar is configured.
- Time zone: stored in UTC; displayed in Africa/Nairobi.
- Browser geolocation is an *input*, not proof of presence.
- Production deployment or real data requires institutional approval (outside this project's initial scope).

## 9. Open decisions

The 18 points the design document says must be settled before coding are tracked, with proposed defaults, in `docs/design/meeting-notes/README.md` (decision log **D-01 … D-18** plus project-specific additions).

## 10. Glossary

| Term | Meaning |
|---|---|
| COD | Coordinator of Department / Academic Officer |
| CAT | Continuous Assessment Test |
| Case / Report | A missing-mark report and its whole lifecycle |
| Normal / Special case | Eligibility classification (advisory) |
| Attendance record | Authoritative, backend-written attendance fact |
| Attendance history | Separate dashboard entry created after a successful record |
| Active report | Not withdrawn and not Closed |
| Mock data | Clearly fake local data used instead of real university data |
