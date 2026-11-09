# Backend

This directory contains the Node.js and Express REST API for the Missing Marks Management System.

## Stack

- Node.js
- Express.js
- JavaScript ES modules
- PostgreSQL
- Prisma ORM
- REST API under `/api/v1`

## Current structure

```text
backend/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.js
├── src/
│   ├── config/
│   ├── middleware/
│   ├── modules/
│   │   ├── auth/
│   │   ├── student/
│   │   ├── lecturer/
│   │   ├── cod/
│   │   └── admin/
│   ├── shared/
│   │   ├── services/
│   │   └── utils/
│   ├── app.js
│   └── server.js
└── tests/
```

## Prerequisites

Use Node.js 20.19+ and npm, plus PostgreSQL for migrations and database-backed features. Prisma CLI and Prisma Client versions are pinned together in `package.json`.

## Setup

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` with a local development `DATABASE_URL` and a random `JWT_SECRET` of at least 32 characters. Configure `APP_BASE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM`, and optional SMTP credentials to deliver verification and password-reset links. Email delivery is unavailable until SMTP is configured. `DEMO_SEED_PASSWORD` is only for synthetic local seed accounts. Do not share or commit `.env`.

Validate the shared schema and generate Prisma Client:

```bash
npm run db:validate
npm run db:generate
```

Apply the committed initial migration to a local development database:

```bash
npm run db:migrate:dev
```

Seed synthetic development data after the migration:

```bash
npm run db:seed
```

For a non-demo deployment, create the first administrator through the one-time bootstrap instead of seeding demo accounts. Set `BOOTSTRAP_ADMIN_NUMBER`, `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` (at least 12 characters), and optionally `BOOTSTRAP_ADMIN_NAME` in `.env`, then run:

```bash
npm run db:bootstrap-admin
```

The bootstrap refuses to run when an active administrator already exists. Before accepting student registrations, an administrator must preload the authoritative registration-number/email roster through `POST /api/v1/admin/student-roster/import`. Lecturer and COD applications remain inactive until email verification and administrator approval.

Never run development migrations against production or an unapproved shared database. The team lead coordinates schema and migration changes.

## Development

The shared scripts include:

```bash
npm run dev
npm test
```

The API and the Feature 5 notification worker run as separate processes:

```bash
npm start
npm run worker:notifications
```

Both use the configured PostgreSQL database. The worker claims outbox rows with leases and PostgreSQL `SKIP LOCKED`; do not start it against a production or shared database without an approved deployment configuration.

Run the database-independent tests with `node --test tests/shared/*.test.js tests/lecturer/lecturer.validation.test.js`. The full suite includes database-backed integration tests and must use a dedicated local test database.

Use the actual scripts present in `package.json`; do not invent local scripts that other team members cannot run.

## Module responsibilities

- `modules/auth`: authentication endpoints and related services.
- `modules/student`: student-facing endpoints.
- `modules/lecturer`: lecturer-facing endpoints.
- `modules/cod`: COD / Academic Officer endpoints.
- `modules/admin`: administrator endpoints.
- `shared`: reusable business services and utilities.
- `middleware`: request authentication, role authorisation, validation and error handling.
- `config`: environment and database configuration.

## Design rules

1. All role modules use the same Express application and PostgreSQL database.
2. Controllers handle HTTP concerns; services implement business rules.
3. Shared workflows, such as attendance, must not be duplicated in each role module.
4. Every protected route must enforce the correct backend permissions.
5. Use Prisma for database access.
6. Coordinate changes to the shared schema, migrations and application entry points.
7. Keep secrets in environment variables and document variable names in `.env.example`, never actual values.

## Testing

Place tests in the matching `tests/` module folder. Test both successful requests and important failure cases, including unauthorised access, invalid input, missing records and invalid workflow transitions.

The current shared tests use Node's built-in test runner (`node --test`) and do not require a live database. Database integration tests should use a dedicated local test database and must never target production.

## API documentation

See `../docs/API.md` for the actual API routes, including Feature 5. Private file upload/download remains pending a storage provider decision; metadata-only evidence responses omit storage keys.
