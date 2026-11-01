# Team Contribution and Collaboration Guide

## 1. Team ownership

The project has four backend contributors:

| Contributor | Primary ownership |
|---|---|
| Team lead | Student module and coordination of shared foundations |
| Member 2 | Lecturer module |
| Member 3 | COD / Academic Officer module |
| Member 4 | Administrator module |

Ownership means responsibility for implementation, tests and documentation in that module. It does not mean a module has its own database, authentication system or copy of shared business logic.

## 2. Branch model

- `main` — stable version.
- `develop` — shared integration branch.
- `feature/*` — new functionality.
- `fix/*` — bug fixes.
- `docs/*` — documentation.

Each developer works on a personal feature branch created from the latest `develop`. All feature pull requests target `develop`.

## 3. How to begin a task

```bash
git switch develop
git pull origin develop
git switch -c feature/your-feature-name
```

Check `git status` before editing. If the branch already exists, switch to it rather than creating a duplicate.

## 4. How to finish a task

```bash
git status
git diff
git add <specific-files>
git commit -m "feat: describe your change"
git push -u origin feature/your-feature-name
```

Open a pull request to `develop`. Include what changed, why it changed, tests performed, endpoints affected and any schema/migration changes.

## 5. Shared ownership rules

Coordinate before changing:

- Prisma schema or migrations.
- Authentication and authorisation.
- Shared middleware and shared services.
- Application entry points (`app.js`, `server.js`).
- Shared dependencies and lockfiles.
- Environment variable definitions.

The team lead coordinates shared schema and migration integration unless the team explicitly changes this assignment. Never merge two competing schema changes without reconciling them against the latest `develop`.

The shared database reference is `docs/DATABASE.md`. Before starting parallel module work, read the approved schema and API contract on `develop`, use the committed lockfile, and do not generate migrations from a divergent schema. Coordinate changes to auth, app/server entry points, middleware and shared services with the team lead.

## 6. Review and merge

The team lead or assigned reviewer checks:

- Does the change satisfy the agreed requirement?
- Is it in the correct module?
- Are permissions and ownership checks enforced?
- Are validation and errors handled?
- Are tests included and passing?
- Does it preserve the shared API and database contracts?
- Is documentation updated?
- Does the branch merge cleanly with current `develop`?

Merge only after required review and checks pass. Merge `develop` into `main` only for an agreed stable release.

## 7. Communication

Before implementing a feature that depends on another member's module, agree on the service or API interface. Raise blockers early. Do not silently change another contributor's files or contracts.

## 8. Definition of done

A task is complete when:

- It matches an agreed requirement.
- It follows the module and shared architecture.
- It enforces authentication, permissions and record ownership.
- It validates inputs and handles expected errors.
- Relevant tests or documented manual checks pass.
- Database and API documentation are updated where needed.
- No secrets or unrelated files are included.
- The PR has been reviewed and merged into `develop`.