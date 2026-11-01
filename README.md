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

### 1. Clone the repository

```bash
git clone <repository-url>
cd missing-marks-management-system
```

### 2. Read the project guides

Read these before implementing a feature:

1. `docs/REQUIREMENTS.md`
2. `docs/WORKFLOW.md`
3. `docs/API.md`
4. `docs/DATABASE.md`
5. `CONTRIBUTING.md`

### 3. Set up the backend

Follow [`backend/README.md`](backend/README.md). Use the shared Prisma schema and migrations; do not create a separate database or independent schema for a role module.

### 4. Set up the frontend

Frontend setup instructions will be added when the React application is initialized.

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
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — short contributor entry point.

## Questions and changes

Raise unclear requirements, proposed schema changes and API changes with the team before implementation. Update the relevant documentation in the same pull request when behaviour or contracts change.