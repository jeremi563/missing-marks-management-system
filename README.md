# Missing Marks Management System

A web-based system for managing missing-mark reports, attendance-related verification and the review process involving students, lecturers, academic officers (CODs) and system administrators.

> **Project status:** Initial development. The documents describe the agreed starting direction. Confirm any unresolved academic rules with the project team and the relevant university stakeholders before treating them as final policy.

## Project goals

- Give students a clear way to submit and track missing-mark reports.
- Give lecturers a structured process to investigate assigned reports and record decisions.
- Give the COD / Academic Officer tools to coordinate departmental review, appeals and escalations.
- Give administrators tools to manage accounts, academic structures and system configuration.
- Maintain traceable records of important actions and decisions.

## Main users

| User | Main responsibility |
|---|---|
| Student | Submit and track own missing-mark reports and view own relevant attendance information. |
| Lecturer | Investigate assigned reports, communicate with students and record permitted decisions. |
| COD / Academic Officer | Coordinate departmental cases, review escalations and handle appeals or special cases. |
| Administrator | Manage accounts, roles, academic structures and system-wide configuration. |

The exact permissions for each endpoint must be enforced by the backend. Hiding a button in the frontend is not access control.

## Technology direction

- Backend: Node.js, Express.js and JavaScript ES modules.
- Database: PostgreSQL.
- ORM and migrations: Prisma.
- API: REST, versioned under `/api/v1`.
- Frontend: React (maintained separately from the backend).

Use the versions agreed in `backend/package.json`. Do not independently upgrade shared dependencies without discussing the impact with the team.

## Repository structure

```text
.
├── backend/                 # Express API and Prisma database layer
├── frontend/                # React client
├── docs/                    # Requirements, database, API and workflow guides
├── .github/                 # Issue and pull-request templates
├── README.md
└── CONTRIBUTING.md
```

See `backend/README.md` for backend setup instructions and `docs/CONTRIBUTION.md` for the team workflow.

## Getting started

### 1. Clone the repository and prepare PostgreSQL

```bash
git clone <repository-url>
cd missing-marks-management-system
```

Install Node.js 20.19 or newer, npm, and PostgreSQL. Start PostgreSQL and create a local development database named `missing_marks`. On Linux, macOS, or Windows where PostgreSQL's command-line tools are on `PATH`, run `createdb missing_marks`; on Windows the executable may be named `createdb.exe`. Alternatively, create the database in pgAdmin. Do not use a production or shared database for local development.

### 2. Configure and install the backend

```bash
cd backend
npm install
cp .env.example .env
```

The commands above work in Linux/macOS shells and Windows PowerShell, except the file-copy command. In PowerShell, use:

```powershell
Copy-Item .env.example .env
```

Edit `backend/.env` and set:

- `DATABASE_URL` to your local PostgreSQL connection. URL-encode special characters in the username or password.
- `JWT_SECRET` to a private random value of at least 32 characters.
- `PORT` if port `3000` is already in use.
- `DEMO_SEED_PASSWORD` to a non-production password of at least 12 characters if you plan to seed demo accounts.

Never commit or share `.env`. It is ignored by Git.

### 3. Apply the database migrations

From the `backend/` directory, validate the schema, generate Prisma Client, check migration status, then apply the committed migrations to your local development database:

```bash
npm run db:validate
npm run db:generate
npm run db:migrate:status
npm run db:migrate:dev
```

The first migration creates the shared database tables. When `migrate dev` reports that the database is up to date, migrations are applied. Do not edit the database manually or create a separate schema for your role module. Coordinate future schema changes and migrations with the team lead.

### 4. Add synthetic demo data (optional)

After setting `DEMO_SEED_PASSWORD` in `.env`, run:

```bash
npm run db:seed
```

The seed creates clearly labelled demo accounts, department, unit, period, lecturer mapping and student enrollment. The demo accounts use the password you set in `DEMO_SEED_PASSWORD`. Never seed real student information.

### 5. Start and check the API

From `backend/`:

```bash
npm run dev
```

The API listens at `http://localhost:3000` by default. In another terminal, check the health endpoint:

```bash
curl http://localhost:3000/health
```

In Windows PowerShell, use either:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

or `curl.exe http://localhost:3000/health` to call the Windows curl executable explicitly.

Expected response:

```json
{"success":true,"data":{"status":"ok"}}
```

The shared API foundation currently includes health and authentication routes (`/api/v1/auth/login`, `/logout`, `/me`). Role-specific student, lecturer, COD and administrator workflows are still being developed; the complete product is not yet available end to end.

### 6. Run tests

From `backend/`:

```bash
npm test
```

For deployment, use `npx prisma migrate deploy` to apply committed migrations. Never use `migrate dev` against production.

### 7. Read the project guides

Read these before implementing a feature:

1. `docs/REQUIREMENTS.md`
2. `docs/WORKFLOW.md`
3. `docs/API.md`
4. `docs/DATABASE.md`
5. `CONTRIBUTING.md`

See [`backend/README.md`](backend/README.md) for additional backend details. The frontend is maintained separately; its setup instructions will be added when the React application is initialized.

## Team module ownership

| Contributor | Module |
|---|---|
| Team lead | Student module and coordination of shared foundations |
| Member 2 | Lecturer module |
| Member 3 | COD / Academic Officer module |
| Member 4 | Administrator module |

Module ownership reduces overlap; it does not create separate applications or separate databases. Shared functionality must be implemented once and reused.

## Important project rules

- `main` is the stable branch; `develop` is the integration branch.
- Create feature branches from the latest `develop`.
- Open pull requests targeting `develop`; do not push directly to `main` or `develop`.
- Coordinate changes to `schema.prisma`, migrations, authentication, shared middleware, `app.js` and `server.js`.
- Never commit `.env` files, passwords, tokens or API keys.
- Do not use real student records in development or demonstrations. Use clearly labelled mock data.
- Do not invent or assume university policy. Confirm uncertain rules before implementing them.

## Documentation

- [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) — system scope and role responsibilities.
- [`docs/DATABASE.md`](docs/DATABASE.md) — database design and migration coordination.
- [`docs/API.md`](docs/API.md) — API conventions and initial endpoint contract.
- [`docs/WORKFLOW.md`](docs/WORKFLOW.md) — report lifecycle and related workflows.
- [`docs/CONTRIBUTION.md`](docs/CONTRIBUTION.md) — contribution and collaboration process.
- [`docs/TEAM_ONBOARDING.md`](docs/TEAM_ONBOARDING.md) — concise step-by-step team onboarding and contribution guide.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — short contributor entry point.

## Questions and changes

Raise unclear requirements, proposed schema changes and API changes with the team before implementation. Update the relevant documentation in the same pull request when behaviour or contracts change.