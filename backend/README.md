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

Install a supported Node.js LTS release, npm and PostgreSQL. The exact versions and scripts should be agreed by the team and recorded in `package.json`.

## Setup

The project is still establishing its shared Prisma schema and authentication foundation. Do not assume the commands below are ready until the team lead has added the corresponding scripts and environment variables.

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env` with your own local development database connection. Do not share or commit your `.env` file.

Once the Prisma schema and scripts have been agreed and committed, use the commands documented by the team lead. Typical Prisma commands may include:

```bash
npx prisma generate
npx prisma migrate dev
```

Do not run migrations against a shared or production database unless explicitly authorised.

## Development

The team will add the agreed scripts to `package.json`, for example:

```bash
npm run dev
npm test
```

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

## API documentation

See `../docs/API.md` for the initial API conventions. Treat example routes as proposed contracts until the team confirms and implements them.