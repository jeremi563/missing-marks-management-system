# Meeting Notes and Decision Log

Every design decision that affects more than one person is recorded here. If it isn't written down, it isn't decided.

## How to use this folder

- One file per meeting: `YYYY-MM-DD-topic.md` (e.g. `2026-10-27-kickoff.md`).
- Decisions get an ID and are summarised in the **decision log** below (this README is the index).
- A decision that changes a rule or contract also updates the matching doc (`requirements.md`, `workflows.md`, `database-design.md`, `api-contracts.md`) **in the same PR**.
- Open questions get a GitHub Issue labelled `decision-needed`.

### Meeting note template

```markdown
# <Topic> — YYYY-MM-DD
**Attendees:**  **Facilitator:**  **Note-taker:**

## Agenda
1.

## Discussion (short)
-

## Decisions
- D-xx / P-xx: <decision> (owner: <name>)

## Action items
| Action | Owner | Due | Issue |
|---|---|---|---|

## Parking lot
-
```

---

## Decision log

**Status:** `Proposed` (default suggested here, needs team confirmation) → `Decided` → `Superseded`.
`D-xx` items are the 18 points the system-design document (§28) requires before coding. `P-xx` items are extra decisions found while writing these docs.

### A. Required before coding (design document §28)

| ID | Question | Proposed default | Needed by | Status |
|---|---|---|---|---|
| D-01 | Account creation and identity verification per role in the demo | Students self-register against a seeded **mock student registry** (registration number must exist). Lecturer/COD/Admin accounts are created by seed or by an admin | Phase 1, Day 1 | Proposed |
| D-02 | Exact report fields; must every report reference an assessment? | Required: unit, academic year, semester, year unit taken, description. **Assessment optional** (nullable). Duplicate rule uses student + unit + assessment (null counts as "no assessment") | Phase 1, Day 1 | Proposed |
| D-03 | Exact state transitions and which rejections allow the single appeal | As in `workflows.md` §1: appeal allowed after **lecturer rejection** and after **COD rejection** if no appeal used yet; appeal decision is final | Phase 1, Day 1 | Proposed |
| D-04 | Does lecturer approval always require COD review? | **Yes** (baseline) | Phase 1, Day 1 | Proposed |
| D-05 | Representing a case awaiting assignment | `assigned_lecturer_id = NULL` while PENDING; shown in a COD/admin "unassigned" queue (`?unassigned=true`); no new status | Phase 1, Day 1 | Proposed |
| D-06 | Classroom boundary method and radius | Circle: centre lat/long + `allowed_radius_meters` per classroom (Haversine distance). **No hard-coded radius**; set per classroom on creation | Phase 2 start | Proposed |
| D-07 | Store coordinates after verification, or only outcome/distance? | Store **outcome + distance only**; raw submitted coordinates are not persisted | Phase 2 start | Proposed |
| D-08 | CAT requirement configuration; rule for Late/Excused | Required CATs flagged per assessment (`required_for_eligibility`); only **PRESENT** satisfies; Late/Excused/Absent → Special | Phase 3 start | Proposed |
| D-09 | Student-specific exam QR or assessment-level opaque reference? | **Assessment-level opaque reference** (one QR per exam, token stored hashed); no student data in QR | Phase 3 start | Proposed |
| D-10 | Attendance history as separate table or derived? | **Separate table** (as specified), created in the same transaction as the attendance record | Phase 2 start | Proposed |
| D-11 | Mark entry/correction and COD approval | Lecturer enters `proposedMark` ≤ assessment max on the decision; COD approval makes it final within the app; nothing syncs externally | Phase 1 | Proposed |
| D-12 | Evidence retention and deletion policy | Keep until case closure + configurable retention; no student deletion after lecturer review starts; admin purge audited | Phase 3 start | Proposed |
| D-13 | Working-day calculation and holidays | Mon–Fri; optional holiday list setting later | Phase 4 | Proposed |
| D-14 | Production email provider | None for now: **mock provider logs emails**; interface allows swapping later | Phase 1 | Proposed |
| D-15 | PDF/Excel libraries | `pdfkit` (or `pdfmake`) and `exceljs` | Phase 4 start | Proposed |
| D-16 | Test coverage and merge approval policy | Lead approval required; tests required for services; target ≥70% on services (informational, not a hard gate in MVP) | Phase 1, Day 1 | Proposed |
| D-17 | Admin 2FA feasibility | **Deferred to Phase 4**, only if time remains; document if dropped | Phase 4 | Proposed |
| D-18 | Schema naming and route contracts | snake_case DB, camelCase JSON, contracts in `api-contracts.md` | Phase 1, Day 1 | Proposed |

### B. Additional decisions raised while writing the docs

| ID | Question | Proposed default | Needed by | Status |
|---|---|---|---|---|
| P-01 | Language and module system | **JavaScript + CommonJS**, ESLint + Prettier, Jest. (TypeScript is possible but adds setup time and Jest/ts config; decide now or never) | Day 1 | Proposed |
| P-02 | Auth cookie and CSRF design | Access 15 min + refresh 7 days (rotated), HttpOnly, SameSite=Lax, strict CORS, JSON-only mutations (see `api-contracts.md` §1.7) | Day 1 | Proposed |
| P-03 | Closing a rejected case when the student does not appeal | `appeal_window_days` setting (default 7). Student may also click "Accept decision". A scheduled job (Phase 4) auto-closes after the window; before that, admin/COD may close manually | Day 1 | Proposed |
| P-04 | Drafts | Separate `report_drafts` table, built in **Phase 3** (MVP submits directly) | Phase 3 | Proposed |
| P-05 | Who can be assigned/reassigned to a report | A lecturer with an active assignment to that unit; a COD may also assign any lecturer in their department; admin any lecturer | Phase 1 | Proposed |
| P-06 | Can students comment? | Only to reply to a lecturer/COD `REQUEST_FOR_INFORMATION` comment | Phase 1 | Proposed |
| P-07 | Where does a reopened case go? | Back to `UNDER_COD_REVIEW`, `reopened_count` +1 | Phase 4 | Proposed |
| P-08 | Case reference numbering | `MMR-<year>-<6 digits>`; one continuous sequence (not reset yearly) | Phase 1 | Proposed |
| P-09 | Eligibility before attendance exists | MVP: `caseClassification = null` and explanation "not evaluated"; Phase 3 plugs in the real engine | Phase 1 | Proposed |
| P-10 | Appeal decision endpoint | Merge into `POST /reports/:id/decisions` (single decision path) instead of a separate appeal-decision endpoint | Phase 1 | Proposed |
| P-11 | Staff account passwords | Seeded in dev; in the app, admin creates the account with a temporary password and the user must change it at first login (flag `must_change_password`) | Phase 1 | Proposed |
| P-12 | Who writes the base skeleton | Lead (with assistant help) creates the skeleton + full Phase 1 schema in Day 1 PRs; others start after merge | Day 1 | Proposed |

---

## Meeting index

| Date | File | Topic | Key decisions |
|---|---|---|---|
| _(none yet)_ | | | |

### Suggested first meeting — Kick-off (60 min)

1. Walk through `docs/requirements/requirements.md` and `docs/design/workflows.md` (15 min).
2. Walk through the PR workflow in `CONTRIBUTING.md`; everyone confirms they can clone, branch and open a PR (10 min).
3. Review the decision log above — confirm or change each **Day 1** item (25 min).
4. Agree on module owners and the Day 1–2 tasks in `docs/design/mvp-plan.md` (10 min).
