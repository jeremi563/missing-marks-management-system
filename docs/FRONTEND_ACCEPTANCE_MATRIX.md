# Frontend Acceptance Matrix

## Purpose and scope

Use this matrix as the frontend completeness checklist before testing communication with the live backend. The UI should first be exercised with deterministic fixture data and mocked API responses; the backend may be stopped during this phase.

This document records the current client route and feature inventory against [REQUIREMENTS.md](REQUIREMENTS.md), [WORKFLOW.md](WORKFLOW.md), and [API.md](API.md). It does not approve unresolved business policy or define new API behavior. Keep the existing landing, login, and registration pages unchanged during this work unless a documented requirement is shown to be impossible to satisfy otherwise. Authentication pages are not part of this phase's redesign scope.

Status meanings:

- **Present**: a matching client route or screen exists in the inspected client.
- **Partial**: some UI exists, but a required action, navigation entry, or state is missing or not yet verified.
- **Missing**: no matching client screen/route was found.
- **Policy check**: acceptance depends on a documented rule that must not be invented in the UI.

These are inventory statuses, not test results. The client baseline tests, production build, and lint were run on 2026-11-11 before follow-up UI changes.

## Shared application shell

| Requirement | Current inventory | Frontend acceptance check |
|---|---|---|
| Public landing and existing login/register experience | Present at `/`, `/login`, and `/register` | Confirm current routes remain intact; do not redesign or alter their behavior in this phase. |
| Protected role areas | Present for Student, Lecturer, COD, and Administrator | With mock authenticated users, each role can open only its own area; unauthorized and unknown routes show the existing access-denied or not-found state. |
| Role navigation | Partial: nav entries exist, but many destinations are not registered routes | Every visible nav item opens a real page; active item, browser back/forward, direct URL, and refresh behave consistently. |
| Shared page states and controls | Shared loading, error, empty, pager, status, form, and confirmation components exist | Check keyboard access, labels, focus, validation feedback, loading/empty/error/success states, and narrow-screen layout on representative pages. |

## Student

| Requirement / workflow | Current inventory | Frontend acceptance check |
|---|---|---|
| Dashboard, profile summary, report counts, recent reports | Present at `/student` | Fixture counts and report summaries match the supplied fixture; loading, empty, error, and retry states work. |
| Create and submit a missing-mark report | Missing: dashboard links to `/student/reports/new`, but no such route or screen is registered. A create API helper exists. Neither the client nor the documented Student API currently supplies the student's enrolled course-unit/academic-period choices needed to obtain valid IDs. | First agree the mocked options response shape and the later live data source. Then a student can select only their enrolled fixture data, enter required fields, receive field-level errors, submit successfully, and see the created report. Do not hard-code arbitrary IDs or invent enrollment data in the runtime UI. |
| List and track own reports | Present at `/student/reports` with local status filtering and paging | Status filtering and paging are correct; each row opens its own detail view; empty and failed-load states are clear. |
| View report details, timeline, and permitted comments | Present at `/student/reports/:reportId` | Timeline order and status/reason display are clear; permitted comments render; blank and over-limit comments are rejected; successful comments appear once. |
| Edit or withdraw a report when allowed | Present for `Submitted` reports on the detail page; mock UI tests cover edit, confirmation-based withdrawal, and hidden actions for other states | Actions appear only when the report state allows them; confirmation, success, and conflict/error states are covered. Do not infer allowed states beyond the approved workflow. |
| Submit an eligible appeal | Partial: `/student/appeals` exists and submits for rejected reports; navigation entry added, behavior still needs UI tests | Eligible, ineligible, and already-appealed fixtures render accurately; reason validation and submit/error/success states work. Apply the documented one-appeal and configurable deadline rules without duplicating or weakening server authority. |
| View attendance history | Present at `/student/attendance` with search and status filtering | Fixture history, status totals, search, filters, empty state, and errors are consistent. Do not present missing records as proof of absence. |
| Submit attendance discrepancy and follow its status | Missing from the client inventory; backend workflow is documented | Student can submit only against their own eligible source; display pending review, clarification, terminal outcome, and retry/error states based on supplied fixture data. |
| View and mark notifications read | Present at `/student/notifications` with filters and mark-read actions | Read/unread state and unread count update correctly; partial failures are visible; linked record navigation is permission-safe. Confirm list pagination behavior against the documented API contract. |
| View own profile and academic information | Present at `/student/profile`; navigation entry added, behavior still needs UI tests | Profile is reachable from navigation; loading, missing-field, error, and retry states remain usable. |

## Lecturer

Current inventory: the `/lecturer` dashboard route renders a generic dashboard. Navigation advertises assigned reports, attendance, and special cases, but those destination routes are not registered; the Lecturer API module is empty.

| Requirement / workflow | Frontend acceptance check |
|---|---|
| View assigned reports and report details within lecturer scope | Mock list, filtering/paging, detail, and out-of-scope/not-found states. |
| Investigate reports, comment/request clarification, and record a reasoned decision | Required fields, allowed actions by status, success, validation, and conflict states. |
| Escalate after an allowed lecturer decision; submit a separate correction proposal | Preserve decision and escalation history in the displayed timeline; do not present a proposal as a direct official-mark change. |
| Manage attendance sessions and review records | Create CLASS/CAT/EXAM sessions using the correct conditional fields; list, detail, start/end, and records states are testable with fixtures. |
| Submit and manage eligible special cases | Category, eligibility, decision, and status display follow supplied data and approved workflow rules. |

## COD / Academic Officer

Current inventory: the `/cod` dashboard route renders a generic dashboard. Navigation advertises reports, appeals, and special cases, but those routes are not registered; the COD API module is empty.

| Requirement / workflow | Frontend acceptance check |
|---|---|
| Review department-scoped reports, lecturer decisions, and escalations | Scope, filters, overdue indicator, history, and empty/error states use only supplied authorized fixtures. |
| Assign/reassign reports and record departmental decisions | Confirmation and reason validation are present; assignment and decision history remain understandable. |
| Review appeals and special cases | Eligible records and decision actions follow the workflow; repeated decisions are prevented in the UI while server conflict responses remain displayable later. |
| Review attendance discrepancies, request clarification, recommend/authorize correction | Distinguish recommendation/authorization from actually changing attendance; show request/response history and current state. |
| View relevant summaries and audit information | Scope and actor/time/reason are clear; sensitive or unrelated records are not rendered. |

## Administrator

Current inventory: the `/admin` dashboard route renders a generic dashboard. Navigation advertises Users, Course Units, and Settings, but those destination routes are not registered; the Admin API module is empty.

| Requirement / workflow | Frontend acceptance check |
|---|---|
| Manage accounts, activation, roles, and approvals | Forms enforce required fields and confirmation for consequential changes; role options do not expose unauthorized self-assignment. |
| Manage departments, courses/units, academic periods, enrolments, and lecturer mappings | Create/update/deactivate flows validate relationships and provide clear success, empty, and conflict states. |
| Configure approved settings and deadlines | Show configured values and constraints; do not imply existing deadline snapshots are recalculated when settings change. |
| View reports, exports, audit history, and archives | Filters, paging, export feedback, and actor/time/reason fields behave with fixture data. |
| Apply an authorized session-attendance correction | Require the approved correction data and reason; clearly distinguish authorization from application; never imply CAT/exam attendance corrections are supported where the workflow says they are not. |
| Perform approved maintenance/reopening actions | Confirmation and resulting status/history are explicit; no direct official-mark editing is exposed. |

## Cross-cutting completion criteria

- Every documented in-scope role workflow has a real route and a reachable navigation path; no placeholder dashboard or dead link stands in for a required workflow.
- Primary UI actions have a mock-backed success path and relevant validation, loading, empty, error, and conflict paths.
- Role-specific views render only the fixture data appropriate to that role. Frontend guards improve navigation but do not replace backend authorization.
- Lists remain understandable with zero, one, and many records; filters and pagination do not lose or duplicate records.
- Forms are keyboard-operable, labels and errors are associated with fields, dialogs have usable focus behavior, and layouts remain usable on mobile-sized viewports.
- Mocking stays at the API boundary and does not become a second source of business rules. Business eligibility and permitted transitions are represented from approved requirements/fixture responses, not guessed in components.
- Login/register behavior and appearance remain unchanged during this phase unless an agreed requirement forces a targeted change.

## Frontend test commands

Run from `client/`:

```bash
npm test
npm run test:ui
npm run build
npm run lint
```

`npm test` remains the Node built-in helper-test runner. `npm run test:ui` runs Vitest with jsdom and Testing Library; API modules are mocked in the UI tests, so these checks do not require a running backend.

## Policy decisions to keep open

Before finalizing UI expectations that depend on these rules, confirm the applicable decisions in [REQUIREMENTS.md](REQUIREMENTS.md) and [WORKFLOW.md](WORKFLOW.md): exact report states/transitions and decision authority; edit/withdraw eligibility; COD versus Academic Officer permissions; attendance source of truth and eligibility calculation; evidence policy; and any remaining deadline or notification behavior. Display backend-provided eligibility and errors rather than hard-coding unresolved policy in the client.

## Current inventory references

- Routes: `client/src/App.jsx`
- Navigation: `client/src/config/navigation.js`
- Student screens: `client/src/features/student/`
- Shared shell: `client/src/layouts/` and `client/src/components/`
- Student API helpers: `client/src/api/student.js`
- Staff API modules: `client/src/api/lecturer.js`, `client/src/api/cod.js`, and `client/src/api/admin.js`