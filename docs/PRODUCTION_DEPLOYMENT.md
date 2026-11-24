# Production Deployment Guide

This deployment uses Vercel for the React frontend, Render for the Express API, and Neon PostgreSQL for data. No production database or credential is included in this repository.

## Architecture

```text
Vercel (frontend) --HTTPS--> Render (Express API) --TLS--> Neon PostgreSQL
```

Prisma migrations must use the **direct** Neon connection URL. Runtime application queries should use the **pooled** Neon connection URL.

## Prerequisites

- GitHub repository access
- A Neon project and staging database
- A Render web-service account
- A Vercel project
- A verified frontend domain
- An authorized operator for migration and backup actions

## Neon

1. Create separate staging and production databases or projects.
2. Copy the direct connection URL for migrations.
3. Copy the pooled connection URL for runtime application traffic.
4. Enable SSL/TLS. Neon connection URLs normally include the required SSL settings.
5. Configure PITR/backups in the Neon console.
6. Verify team and audit access before production release.

Never execute destructive migration commands against production.

## Render Backend

Use `render.yaml` as a starting blueprint or configure manually:

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Runtime | Node.js |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Health check | `/health` |
| Readiness check | `/health/ready` |

Required environment variables:

- `NODE_ENV=production`
- `DATABASE_URL=<pooled Neon runtime URL>`
- `DATABASE_POOL_URL=<pooled Neon runtime URL>` (optional alias; takes precedence)
- `DIRECT_DATABASE_URL=<direct Neon migration URL>`
- `JWT_SECRET=<32+ character random secret>`
- `CORS_ORIGINS=https://<production-vercel-domain>`
- `APP_BASE_URL=https://<production-vercel-domain>`
- `TRUST_PROXY=1`
- `COOKIE_SAME_SITE=none`

Optional SMTP variables:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`

The service exits if its production database connection cannot be established. `/health` reports process availability; `/health/ready` reports database availability.

## Vercel Frontend

Create the project with:

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Framework | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |

Required production environment variable:

- `VITE_API_BASE_URL=https://<render-service-host>/api/v1`

Preview deployments should use a staging Render URL. `vercel.json` contains the SPA fallback required for direct navigation to nested routes.

## Migration Procedure

Run only with an authorized operator and an approved database target:

```bash
cd backend
npx prisma validate
npx prisma generate
npx prisma migrate deploy
npx prisma migrate status
```

`DIRECT_DATABASE_URL` must point to the direct Neon URL for these commands. Do not run migrations through Render's normal web-service startup command.

The recommended release sequence is:

1. Back up or verify PITR before migration.
2. Deploy or launch a maintenance release if required.
3. Run migration status and migrate deploy through an isolated release job.
4. Verify migration status.
5. Deploy the backend.
6. Verify `/health/ready`.
7. Deploy the frontend.
8. Run staging smoke tests.

Existing migration files are never rewritten or deleted. Fixes must be forward migrations.

## Staging

1. Create a Neon staging database.
2. Apply all migrations with the direct staging URL.
3. Create a Render staging service.
4. Create a Vercel preview or staging project.
5. Set staging CORS origins exactly.
6. Set the frontend staging API URL.
7. Run the complete CI workflow.
8. Test all roles and the missing-marks workflow with synthetic records.

## Authentication and Cookies

The frontend and backend are expected to be on different sites. Production therefore uses:

- `COOKIE_SAME_SITE=none`
- `secure=true` in production
- explicit CORS origin allowlisting
- credentials enabled by the frontend Axios client

Do not use `*` CORS origins. Do not add localhost origins to production `CORS_ORIGINS`.

## Rollback

Prisma migrations are forward-only. Rollback requires:

- Application rollback to the previous compatible release.
- A documented forward database fix if schema changes are incompatible.
- Neon PITR restoration only by an authorized database operator.

Do not restore or seed production records through application scripts without explicit authorization.

## Troubleshooting

- `401/403`: verify JWT secret consistency and cookie `Secure`, `SameSite`, CORS, and HTTPS settings.
- Database unavailable: verify pooled/direct Neon URLs, SSL, and service IP/network access.
- Migration failure: stop deployment, capture migration status, and use a forward fix or restore plan.
- CORS failure: verify `CORS_ORIGINS` contains only the exact Vercel origin, with no trailing slash.
- Email unavailable: verify SMTP variables; the application may operate but verification/recovery email delivery will not.

## Security Checklist

- No secrets in GitHub, Render manifests, Vercel settings files, or frontend bundles.
- JWT secret is random and at least 32 characters.
- HTTPS is enabled at Vercel and Render.
- CORS origins are explicit.
- Branch protection requires CI and independent review.
- Production database credentials are never printed in logs.
- Backups/PITR are enabled and recovery responsibilities are assigned.
