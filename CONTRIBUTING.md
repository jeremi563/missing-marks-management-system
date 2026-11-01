# Contributing

Thank you for contributing to the Missing Marks Management System. All four developers contribute to the backend, with each developer owning a role-based module.

Before coding, read:

- `README.md`
- `docs/REQUIREMENTS.md`
- `docs/WORKFLOW.md`
- `docs/API.md`
- `docs/DATABASE.md`
- `docs/CONTRIBUTION.md`

## 1. Branches

- `main`: stable, reviewed version.
- `develop`: integration branch.
- `feature/<short-name>`: feature work.
- `fix/<short-name>`: bug fixes.
- `docs/<short-name>`: documentation-only changes.

Examples:

```text
feature/student-backend
feature/lecturer-backend
feature/cod-backend
feature/admin-backend
docs/api-contract
```

## 2. Standard workflow

```bash
git switch develop
git pull origin develop
git switch -c feature/short-feature-name

# Implement and test your change
git status
git add <files>
git commit -m "feat: describe the change"
git push -u origin feature/short-feature-name
```

Open a pull request on GitHub with **base branch `develop`**. Do not open feature PRs against `main`.

If the branch already exists locally, switch to it instead of creating it again. Before starting another task, update your local `develop` branch and create a fresh feature branch.

## 3. Commit messages

Use a short, descriptive prefix:

- `feat:` new functionality
- `fix:` bug fix
- `docs:` documentation
- `test:` tests
- `refactor:` code restructuring without intended behaviour change
- `chore:` tooling, dependencies or project maintenance

Examples:

```text
feat: add student report submission
fix: prevent duplicate appeal submission
docs: document lecturer report endpoints
test: cover report assignment service
chore: configure prisma scripts
```

## 4. Module ownership

- Team lead: Student module; coordinates shared foundations.
- Member 2: Lecturer module.
- Member 3: COD / Academic Officer module.
- Member 4: Administrator module.

Stay within your module where possible. If your feature needs another module or a shared service, discuss the interface with its owner before changing it.

## 5. Shared-file coordination

The following files affect the whole application and must not be changed independently by multiple contributors:

- `backend/prisma/schema.prisma` and `backend/prisma/migrations/`
- Authentication and authorisation middleware.
- `backend/src/app.js` and `backend/src/server.js`.
- Shared services and common utilities.
- `backend/package.json` and lockfile.
- `.env.example` and shared configuration.

The team lead coordinates the Prisma schema and migration integration unless the team explicitly assigns another maintainer. Contributors should raise a proposed change, agree on its fields/relations/interface, then implement it in a coordinated branch or PR.

## 6. Pull-request requirements

A PR should:

- Have a clear title and explain the purpose.
- Target `develop`.
- Contain one focused feature or a small related set of changes.
- Identify the module and files affected.
- Describe API changes, request/response changes and permission requirements.
- Describe Prisma schema or migration changes, if any.
- State tests run and their results.
- Include screenshots only when they materially help review UI work.
- Update documentation when requirements, routes, data or workflow behaviour changes.

Do not merge a PR with unresolved conflicts, failing checks or unreviewed breaking changes.

## 7. Code and security expectations

- Use JavaScript ES modules (`import` / `export`).
- Keep controllers focused on HTTP request/response handling; put reusable business rules in services.
- Validate incoming data at the API boundary.
- Enforce authentication and role permissions on the backend.
- Return only the data a caller is authorised to see.
- Use Prisma for database access; do not introduce a second database access pattern without team agreement.
- Do not log passwords, access tokens or sensitive student data.
- Never commit `.env`, credentials or private keys.
- Use mock data for development and demos.

## 8. Before requesting review

Run the checks available in `backend/package.json`, inspect `git diff`, and verify that your change does not break another role's workflow. If tests are not yet configured, state the manual verification steps clearly in the PR.