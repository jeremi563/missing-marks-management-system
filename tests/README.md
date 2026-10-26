# Project-Level Tests (acceptance & end-to-end)

This top-level folder holds tests that span the whole system and are **not** tied to one backend module:

| Kind | Where | Purpose |
|---|---|---|
| Backend unit/integration | `backend/tests/` | Developer tests run in CI — see `backend/tests/README.md` |
| API acceptance (manual/Postman) | `tests/postman/` *(Phase 1, task T-127)* | Collection + environment that replays the MVP journey end-to-end |
| Manual acceptance scripts | `tests/acceptance/` | Step-by-step checklists a human runs before each release |
| Browser end-to-end *(later, optional)* | `tests/e2e/` | Only if time allows after the frontend exists |
| Test data notes | `tests/data/` | Description of the mock dataset used in demos (no real data) |

Strategy, test levels and the defect process are in `docs/testing/README.md`.

## Acceptance scenarios (Phase 1 MVP)

Run against a freshly migrated + seeded database. Use seeded accounts from `backend/README.md`.

| ID | Scenario | Expected result |
|---|---|---|
| AT-01 | Student registers with a registration number that exists in the mock registry | Account created; login works |
| AT-02 | Registration with an unknown number / weak password / duplicate email | Rejected with clear validation errors |
| AT-03 | 5 wrong passwords then correct password | Locked for 30 min; message shows lock; audit entry |
| AT-04 | Student submits a report for an enrolled unit | `201`, reference `MMR-…`, status Pending, lecturer assigned, notification created |
| AT-05 | Same student submits again for same unit/assessment | `409 DUPLICATE_ACTIVE_REPORT` |
| AT-06 | Submit for a unit with **no lecturer mapping** | Report created unassigned; appears in COD/admin unassigned queue |
| AT-07 | Student edits and withdraws while Pending; resubmits | Allowed; resubmission succeeds |
| AT-08 | Lecturer starts review | Status Under Review; student can no longer edit (`REPORT_LOCKED`) |
| AT-09 | Lecturer rejects without reason | `422 REASON_REQUIRED` |
| AT-10 | Lecturer proposes a mark above assessment maximum | `422 MARK_EXCEEDS_MAXIMUM` |
| AT-11 | Lecturer approves → COD starts review → COD approves | Case Closed; student notified; timeline complete |
| AT-12 | Lecturer rejects with reason → student appeals once → COD decides | Case Closed; second appeal → `409 APPEAL_ALREADY_USED` |
| AT-13 | Lecturer comments become immutable once COD review starts; new comments allowed | Edit blocked, add works |
| AT-14 | Student opens another student's report | `404` |
| AT-15 | Lecturer opens a report not assigned to them | `404` |
| AT-16 | COD opens another department's report | `404` |
| AT-17 | Non-admin calls audit-log endpoint | `403` |
| AT-18 | Admin views audit log after AT-04…AT-12 | Entries for each important action with actor, time, reason |
| AT-19 | Reassign by COD with and without reason | With reason OK + history row; without → `REASON_REQUIRED` |
| AT-20 | Deactivated user tries to log in | Rejected; old records still visible to staff |

Later phases add: attendance link/QR with location (AT-2xx), CAT (AT-3xx), exam QR (AT-4xx), special-case evidence, exports, maintenance mode, archive access.

## Manual acceptance procedure
1. Reset DB: `npm run db:reset` in `backend/`.
2. Start the API.
3. Run the Postman collection in order, or follow the scenario table by hand.
4. Record results in the release checklist (`tests/acceptance/release-checklist.md`, created at the first release): scenario ID · pass/fail · tester · date · defect link.
5. Any failure → GitHub Issue (**Bug** template) before the release PR is merged.

## Release gate (before merging `develop` → `main`)
- [ ] CI green on `develop` (lint + tests)
- [ ] Migrations apply on a clean database; seed works
- [ ] All acceptance scenarios for the phase pass
- [ ] No open `bug` issue that breaks a business rule or security
- [ ] README, OpenAPI, Postman and contracts match the implementation
- [ ] Release PR approved by the lead; tag created
