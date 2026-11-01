# Team Onboarding

A short guide for contributing without duplicating shared work. Read this with `README.md`, `docs/REQUIREMENTS.md`, `docs/WORKFLOW.md`, `docs/API.md`, `docs/DATABASE.md`, and `CONTRIBUTING.md`.

## What the repository already provides

- One Node.js/Express API, PostgreSQL database and shared Prisma setup under `backend/`.
- A common Prisma schema and initial migration in `backend/prisma/`. The database table and relationship reference is `docs/DATABASE.md`.
- Shared environment loading, Prisma connection setup, Express app/server, authentication and authorization middleware, request validation, error responses, and auth routes for login/logout/current user.
- Shared services/utilities for audit records, notifications, attendance eligibility, API responses, and report references.
- Synthetic demo seed setup and shared tests. Never use real student data or commit `.env`.

These are shared foundations. Do not create another database, Prisma schema, authentication system, or duplicate shared service inside a role module.

## Work ownership

- **Team lead:** Student module and coordination of schema, migrations, auth, shared middleware/services, app/server, dependencies, and shared contracts.
- **Member 2:** Lecturer module.
- **Member 3:** COD / Academic Officer module.
- **Member 4:** Administrator module.

Implement missing endpoints and business logic in the assigned module’s routes, controller, and service files. Add module tests under the matching `backend/tests/` folder. Reuse shared services where they apply.

## Step-by-step contribution process

1. **Understand the contract.** Read the requirements, workflow, API and database guides. Treat any item listed as an open question as undecided; ask the team lead before choosing a rule.
2. **Update your branch.** From the repository root:

   ```bash
   git switch develop
   git pull origin develop
   git switch -c feature/short-task-name
   ```

3. **Set up the backend.** From `backend/`, run `npm install`, copy `.env.example` to `.env`, and set your own local development `DATABASE_URL` and a private `JWT_SECRET`. Do not send credentials in chat or commit `.env`.
4. **Prepare the local database.** Run `npm run db:validate`, `npm run db:generate`, and `npm run db:migrate:dev`. Use `npm run db:seed` for synthetic demo records. Never point development migrations at production or an unapproved shared database.
5. **Implement only the agreed slice.** Keep HTTP handling in controllers, business rules in services, and validate inputs at the API boundary. Enforce authentication, role, ownership and department/unit scope on the server. Do not change official university marks.
6. **Test and document.** Run `npm test` and relevant Prisma checks. Add tests for success, validation, permissions and important failure cases. Update API/workflow/database docs when your change alters a contract or behavior.
7. **Commit and push your branch.** From the repository root:

   ```bash
   git status
   git diff --check
   git add <your-files>
   git commit -m "feat: describe your change"
   git push -u origin feature/short-task-name
   ```

8. **Open a pull request.** Set the base branch to `develop`. Describe the change, affected endpoints/modules, tests run, and any schema/migration impact. Request review; do not push directly to `develop` or `main`.

## Shared-file rule

Coordinate before changing `backend/prisma/schema.prisma`, migrations, authentication/authorization, shared middleware/services, `app.js`, `server.js`, `backend/package.json`, its lockfile, or environment definitions. The team lead integrates schema changes so everyone builds against the same contract. Do not independently create competing migrations.

## Current open decisions

The repository documentation still leaves report states/transitions, decision authority, student edit/withdraw rules, appeal limits, attendance eligibility/source, deadlines, and evidence retention open. Do not hard-code these assumptions. Raise them with the team lead and record agreed decisions in the relevant docs before implementing them.
