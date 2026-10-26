# Contributing Guide

How the four of us work together on the Missing Marks Management System. Read this once, then follow it for every task.

**Roles in the workflow**

| Role | Who | Responsibility |
|---|---|---|
| Team Lead / Reviewer | Project owner | Creates issues, assigns daily tasks, reviews and merges every PR, merges `develop` → `main` |
| Developer | Each of the four members | Takes one issue at a time, implements it, opens one PR per issue |
| Buddy reviewer | Rotating teammate | Optional second look on a PR (see §6) so the lead is not the only bottleneck |

---

## 1. Principles

1. **Small, daily, reviewable.** One issue = one branch = one PR. Target: finished and merged within one working day.
2. **Nobody commits directly to `main` or `develop`.** Everything arrives through a reviewed PR.
3. **`develop` must always run.** If it is broken, fixing it is everyone's first priority.
4. **Shared contracts first.** Database schema, API contracts and business rules are agreed in the docs before code (see §9).
5. **The backend is the security boundary.** Every protected endpoint checks authentication, role, ownership/scope and state (see `docs/architecture/README.md`).
6. **Mock data only.** Never commit real student data, real emails or real secrets.

---

## 2. Branch model

| Branch | Purpose | Who pushes | How it changes |
|---|---|---|---|
| `main` | Stable, tested release. Tagged versions (`v0.1.0` …) | Nobody directly | PR/merge from `develop` by the lead, after release checks |
| `develop` | Integration branch. Always runnable | Nobody directly | Squash-merged PRs from short-lived branches |
| short-lived branches | One task each | The assigned developer | Created from latest `develop`, deleted after merge |

The existing `docs` branch is merged into `develop` once (first PR) and then retired. Documentation changes after that follow the normal flow with a `docs/...` branch.

### Branch naming

```
<type>/<issue-number>-<short-kebab-description>
```

| Type | Use for | Example |
|---|---|---|
| `feature` | New functionality | `feature/112-report-submit` |
| `fix` | Bug fix | `fix/140-duplicate-check-withdrawn` |
| `docs` | Documentation only | `docs/150-api-contract-reports` |
| `test` | Tests only | `test/151-idor-report-access` |
| `refactor` | Behaviour-preserving cleanup | `refactor/160-extract-pagination` |
| `chore` | Tooling, config, dependencies | `chore/101-eslint-prettier` |

The issue number is mandatory — it links work to the task board.

---

## 3. The task lifecycle (follow in order)

### Step 1 — Pick up your issue
- The lead creates a GitHub Issue per task (template: **Task**) and assigns it to you with a phase label (`phase-1-mvp` …) and module label (`auth`, `reports` …).
- Move it to **In progress** on the board. One in-progress issue per person.
- Unclear? Comment on the issue **before** coding. Don't guess on contract or business-rule questions.

### Step 2 — Create your branch from the latest `develop`
```bash
git checkout develop
git pull origin develop
git checkout -b feature/112-report-submit
```

### Step 3 — Work in small commits
- Commit often, each commit compiles and makes sense alone.
- Follow the commit convention in §4.
- Write/adjust tests **with** the code, not afterwards.
- If you change an API shape or database model, update `docs/design/api-contracts.md` or `docs/design/database-design.md` **in the same PR** (and see §9 for shared files).

### Step 4 — Stay up to date
At least once a day, and always right before opening the PR:
```bash
git fetch origin
git rebase origin/develop
```
Resolve conflicts locally. Never merge `develop` into your branch (it creates noisy history). If a rebase gets messy, ask for help before force-pushing.
After a rebase, push with `git push --force-with-lease` (never plain `--force`).

### Step 5 — Pre-PR self-check
Run from `backend/` and tick each item in the PR template:
- [ ] `npm run lint` passes
- [ ] `npm test` passes (new code has tests)
- [ ] App starts and your endpoint works (manual check via Postman/curl)
- [ ] If schema changed: migration created, `npx prisma migrate dev` works on a clean database, seed still runs
- [ ] No `console.log` debugging left, no secrets, no `.env`
- [ ] Docs/contracts updated if behaviour changed
- [ ] You re-read your own diff on GitHub (you will catch things)

### Step 6 — Push and open the Pull Request
```bash
git push -u origin feature/112-report-submit
```
- **Base branch: `develop`** (double-check — this is the most common mistake).
- Title: `<type>(<scope>): <summary>` e.g. `feat(reports): submit report with duplicate check`.
- Fill in the PR template completely. Link the issue with `Closes #112`.
- Open as **Draft** if you want early feedback; mark **Ready for review** when the checklist is complete.
- Add labels (`phase-1-mvp`, module) and request review from the lead.

### Step 7 — Review and revise
- Respond to every comment (fix it, or explain why not). Don't resolve a thread the reviewer opened — the reviewer resolves it.
- Push fix commits to the same branch; the PR updates automatically.
- Re-request review when ready.

### Step 8 — Merge (lead only)
- Merge method: **Squash and merge** into `develop`. The squashed commit message follows §4 and ends with `(#PR)`.
- Delete the branch after merge.
- Developer: `git checkout develop && git pull`, then pick up the next issue.

---

## 4. Commit messages (Conventional Commits)

```
<type>(<scope>): <imperative summary, max ~72 chars>

<optional body: what and why, not how>
```

| Type | Meaning |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `test` | Tests |
| `refactor` | Code change without behaviour change |
| `chore` | Build, tooling, dependencies |
| `perf` | Performance improvement |

**Scope** = module name: `auth`, `users`, `academic`, `reports`, `appeals`, `attendance`, `cat`, `exam`, `discrepancies`, `special-cases`, `notifications`, `audit`, `admin`, `reporting`, `core`, `db`.

Examples:
```
feat(auth): lock account after five failed logins
fix(reports): allow resubmission after withdrawal
docs(api): document appeal endpoints
test(reports): cover one-appeal-per-case rule
```

---

## 5. Pull request rules

- **One concern per PR.** No drive-by refactors or unrelated fixes — open a separate issue.
- **Size:** aim for under ~400 changed lines (excluding lockfiles/generated files). Larger? Split it, or talk to the lead first.
- **Must be green:** lint + tests (CI, once enabled) pass before review.
- **No half-finished features in `develop`:** if a feature spans several PRs, each PR must leave the app working (new endpoints may exist but be unused).
- **Never include:** `.env`, secrets, `node_modules`, uploaded files, personal IDE config.
- **Migrations are append-only.** Never edit a migration that has been merged; add a new one.

---

## 6. Review process

**Turnaround:** the lead reviews within 24 hours (same working day where possible). Developers: review requests from teammates also count as work — don't leave them waiting.

**Two-step review**
1. **Buddy review (recommended, non-blocking):** a rotating teammate (A→B→C→D→A) skims for obvious issues, readability and tests. Leave comments; no formal approval needed.
2. **Lead review (required):** the lead approves and merges.

**Reviewer checklist**
- [ ] Does it do exactly what the issue asks — nothing more?
- [ ] Business rules match `docs/design/workflows.md` and `docs/requirements/requirements.md`?
- [ ] **Authorization:** role check *and* ownership/department/assignment scope enforced in the service/query, not just the route?
- [ ] **Validation:** Zod schemas for body, params and query?
- [ ] **State rules:** allowed transitions enforced; locked data cannot be edited?
- [ ] **Audit/notifications:** written for important actions, inside the same transaction where required?
- [ ] Response uses the standard envelope and correct HTTP status; errors are safe (no stack traces, SQL, paths)?
- [ ] Queries are scoped (no IDOR), paginated, and indexed where filtered?
- [ ] Layering respected: routes → controllers → services → Prisma (no business logic in routes/controllers)?
- [ ] Tests: happy path, permission failure, validation failure, and the key business-rule failure?
- [ ] No secrets, no debug logs, no dead code?
- [ ] Docs/contracts/migration updated?

**Outcomes:** *Approve* (merge) · *Request changes* (must fix) · *Comment* (non-blocking suggestion; prefix with `nit:` for style-only).

Review the code, not the person. Ask questions instead of issuing orders ("What happens if the report is already withdrawn?").

---

## 7. Daily rhythm

| Time | Activity |
|---|---|
| Start of day | Lead assigns/confirms today's issue (or it's already on the board). Everyone pulls `develop`. |
| During day | Work in your branch; post blockers in the team chat immediately; rebase on `develop` before lunch. |
| End of day | PR opened (Ready for review) — or Draft with a note on what's left. Quick status in chat: *done / next / blocked*. |
| Next morning | Address review comments first, then start the next issue. |

Keep a short **weekly sync** (30 min): demo what merged, review upcoming tasks, decide open questions. Record decisions in `docs/design/meeting-notes/` (see its README).

---

## 8. Keeping `main` stable (release flow)

1. When a phase is finished and demoable, the lead checks: all tests pass on `develop`, migrations apply to a clean database, seed works, README/OpenAPI/Postman updated.
2. Open a PR `develop` → `main` titled `release: v0.X.0 <phase name>`.
3. Merge with a **merge commit** (not squash) so `main` keeps the release boundary.
4. Tag: `git tag -a v0.1.0 -m "Phase 1 MVP"` then `git push origin v0.1.0`.

**Hotfix** (bug on `main` only): branch `fix/<issue>-...` from `main`, PR into `main`, then immediately merge `main` back into `develop` so the fix isn't lost. Use sparingly.

Version plan: `v0.1.0` Phase 1 MVP · `v0.2.0` attendance · `v0.3.0` CAT/exam/special cases/eligibility · `v0.4.0` admin & reporting · `v1.0.0` final demo.

---

## 9. Shared files — extra care

These files are conflict hot-spots. Follow the rule to keep parallel work smooth.

| File / area | Rule |
|---|---|
| `backend/prisma/schema.prisma` and `prisma/migrations/` | Change only when your issue says so. Keep the schema change in its **own small PR** if possible; merge it fast and tell the team in chat so everyone rebases. Two people never change the schema on the same day without agreeing first. |
| `docs/design/database-design.md` | Update in the same PR as the schema change. |
| `docs/design/api-contracts.md` and `docs/api/openapi` | Update in the same PR as the endpoint. Contract changes that affect another member's module need a heads-up in the issue first. |
| `backend/src/routes/index.js` (route registry) | Add only your one line. Don't reorder or reformat. |
| `package.json` / lockfile | Add dependencies only when needed; mention each new one in the PR. Prefer already-agreed libraries (see architecture doc). |
| Core business rules / status model | Don't change silently. Open an issue → discuss → record in meeting notes → update docs → then code. |

---

## 10. Definition of Done

A task is done when **all** are true:
- Acceptance criteria in the issue are met.
- Code follows the layering and naming conventions; lint passes.
- Automated tests cover the new behaviour (happy path + failure paths + permissions).
- Authorization and validation are enforced server-side.
- Audit event and notification created where the workflow requires.
- Contracts/docs/migrations updated.
- PR reviewed, approved and merged into `develop`.
- Issue closed and moved to **Done**.

---

## 11. Code style

- Language: JavaScript (Node.js) with ES modules: `import`/`export`, `"type": "module"`, and the `.js` extension on relative imports (decision P-01).
- ESLint + Prettier enforce formatting — don't argue style in reviews, let the tools decide.
- Names: `camelCase` variables/functions, `PascalCase` classes/Prisma models, `kebab-case` file names (`report.service.js`), `UPPER_SNAKE_CASE` constants and enum values, `snake_case` database columns (mapped in Prisma).
- File naming per module: `<module>.routes.js`, `<module>.controller.js`, `<module>.service.js`, `<module>.schema.js` (Zod), `<module>.test.js`.
- Controllers stay thin; **business rules live in services**; only services call Prisma.
- Throw typed application errors (e.g. `NotFoundError`, `ForbiddenError`, `ConflictError`); the central error handler converts them to the standard error envelope.
- Comment the *why*, not the *what*.

---

## 12. Secrets and data

- Real `.env` files are **never** committed. Copy `.env.example` to `.env` locally.
- Add every new environment variable to `.env.example` (placeholder value) and `backend/README.md`.
- Seed data is clearly fake (e.g. `student1@mock.kisiiuniversity.test`).
- Do not log passwords, tokens, reset links or precise location data.

---

## 13. GitHub repository setup (lead does once)

**Branch protection** (Settings → Branches), for `main` and `develop`:
- Require a pull request before merging
- Require at least 1 approval
- Require status checks to pass (add once CI exists)
- Require branches to be up to date before merging
- Block force pushes and deletions

> The repository is currently public, so branch protection is available. If it becomes private later, check that your GitHub plan still supports it; if not, the rule is enforced by team discipline — nobody pushes to `main`/`develop`.

**Public repository warning:** everything committed is visible to everyone, including history. Never commit secrets or real data; if one slips in, rotate it immediately (deleting the commit is not enough).

**Other settings:** allow *squash merging* (default to PR title), disable plain merge commits for `develop` (keep for `main` releases), enable *auto-delete head branches*.

**Labels:** `phase-1-mvp`, `phase-2-attendance`, `phase-3-assessments`, `phase-4-admin`, module labels (`auth`, `reports`, …), `bug`, `docs`, `blocked`, `decision-needed`, `good-first-task`.

**Project board columns:** Backlog → Ready → In progress → In review → Done.

The templates in `.github/` (PR template, Task and Bug issue templates) are applied automatically.

---

## 14. Getting help

Stuck for more than ~30 minutes? Post in the team chat with: what you tried, the error, your branch name. Blocked tasks get the `blocked` label so the lead can re-plan the day.
