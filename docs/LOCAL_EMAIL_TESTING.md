# Local email testing with Mailpit

The authentication service creates single-use, hashed verification/reset tokens and sends them through the Nodemailer SMTP service. The SMTP transport is reused until its connection configuration changes; SMTP diagnostics are explicit and do not block application startup. Messages include plain-text and HTML bodies. Mailpit captures email locally for development; it is not part of production deployment and must not be used with production data or accounts. The Compose service is available only through the `email-testing` profile and publishes ports on loopback.

## Start and stop Mailpit

Run these commands from the repository root.

Start:

```bash
docker compose --profile email-testing up -d mailpit
```

Stop and remove the container:

```bash
docker compose --profile email-testing down
```

The web interface is at <http://localhost:8025>. SMTP listens on `127.0.0.1:1025`. Messages are held in Mailpit and are not forwarded externally.

## SMTP configuration

The root `.env.example` (copied to `backend/.env` by the backend setup instructions) contains local Mailpit settings. Configure these only in a development environment:

```env
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_FROM="Missing Marks System <no-reply@missingmarks.local>"
APP_BASE_URL=http://localhost:5173
```

Leave `SMTP_USER` and `SMTP_PASSWORD` empty or unset. The sender setting accepts either a bare email address or `Name <address>`. Never use production SMTP credentials or a production database for these tests; there is no production SMTP fallback in the local setup.

The backend currently runs directly on Ubuntu, so `127.0.0.1` is the correct SMTP host. If you later run the backend in Docker Compose, attach it to the same Compose network and set `SMTP_HOST=mailpit`; `127.0.0.1` inside the backend container refers to that container, not Mailpit. The current repository does not run the backend or PostgreSQL through Compose.

Start the backend with SMTP settings explicitly overridden for this process. This does not edit `backend/.env`; it also prevents any SMTP credentials already present there from being used:

```bash
cd backend
SMTP_HOST=127.0.0.1 \
SMTP_PORT=1025 \
SMTP_SECURE=false \
SMTP_USER= \
SMTP_PASSWORD= \
SMTP_FROM="Missing Marks System <no-reply@missingmarks.local>" \
APP_BASE_URL=http://localhost:5173 \
npm run dev
```

Confirm `DATABASE_URL` in the development environment points to a dedicated local development database before starting the backend. Do not run these workflows against production or shared accounts.

## Test authentication email workflows

Use the running backend with a **development database** and synthetic accounts. The API base below is `http://localhost:3000/api/v1`. Requests that use browser cookies require a CSRF token from `GET /auth/csrf` and the matching `X-CSRF-Token` header/cookie. A bearer-token client may omit CSRF protection as implemented by the API.

### Request a verification message

`POST /auth/resend-verification` accepts exactly an `email` field. It sends only for an existing account whose email is not yet verified.

```json
{
  "email": "unverified-user@missingmarks.local"
}
```

For the API's default generic response (without cookies or an `Origin` header):

```bash
curl -i -X POST http://localhost:3000/api/v1/auth/resend-verification \
  -H 'Content-Type: application/json' \
  --data '{"email":"unverified-user@missingmarks.local"}'
```

### Request a password-reset message

`POST /auth/forgot-password` accepts exactly an `email` field. It sends only for an existing, active account with a verified email.

```json
{
  "email": "verified-user@missingmarks.local"
}
```

```bash
curl -i -X POST http://localhost:3000/api/v1/auth/forgot-password \
  -H 'Content-Type: application/json' \
  --data '{"email":"verified-user@missingmarks.local"}'
```

### Request an email-change verification message

`POST /auth/change-email` requires an authenticated user and accepts exactly `email` and `currentPassword`. Use a synthetic account and new local recipient address.

```json
{
  "email": "new-address@missingmarks.local",
  "currentPassword": "the-synthetic-account-password"
}
```

This request requires an authenticated local session. For cookie-based authentication, first obtain a CSRF token from `GET /api/v1/auth/csrf`, then include both the session cookie and matching `X-CSRF-Token` header on the request. The response indicates whether the email send succeeded; the account's email changes only after the verification link is used. Do not paste real passwords or tokens into shared terminals, logs, or documentation.

### Inspect captured messages

Open <http://localhost:8025> and select a message to view:

- Sender (`From`), recipient (`To`), and subject.
- Plain-text body and raw message details.
- The verification URL (`/verify-email`) or reset URL (`/reset-password`).
- The `token` query parameter in the URL. It is a real one-time security token, even in development; do not share screenshots or copied links.

The email service sends both plain-text and HTML alternatives. Email-change verification uses the verification URL and is sent to the new address. The `token` query parameter in the intended action URL contains a single-use token; Mailpit does not forward the message externally.

## Diagnostics and automated tests

The diagnostic checks SMTP connectivity only. It does not connect to the database or send an email. The dummy database URL and JWT secret satisfy global configuration validation and are not used by the command.

```bash
cd backend
DOTENV_CONFIG_PATH=/dev/null \
DATABASE_URL='postgresql://test:test@127.0.0.1:1/test?schema=public' \
JWT_SECRET=email-diagnostic-test-secret-with-at-least-32-characters \
SMTP_HOST=127.0.0.1 SMTP_PORT=1025 SMTP_SECURE=false \
SMTP_USER= SMTP_PASSWORD= SMTP_FROM=no-reply@missingmarks.local \
APP_BASE_URL=http://localhost:5173 \
npm run email:diagnose
```

Run the email service, environment, and authentication tests without requiring SMTP credentials or a database connection:

```bash
cd backend
DOTENV_CONFIG_PATH=/dev/null \
DATABASE_URL='postgresql://test:test@127.0.0.1:1/test?schema=public' \
JWT_SECRET=email-test-secret-with-at-least-32-characters \
SMTP_HOST= SMTP_PORT= SMTP_USER= SMTP_PASSWORD= SMTP_FROM= APP_BASE_URL= \
node --test tests/config/email-env.test.js tests/shared/email.service.test.js \
  tests/auth/auth-email.service.test.js tests/auth/auth-email.routes.test.js
```

Run the Mailpit integration test separately. It requires the local Mailpit SMTP and HTTP ports to be reachable, forces loopback SMTP with no authentication, uses synthetic in-memory accounts, and does not connect to a database:

```bash
cd backend
npm run test:email:mailpit
```

The test calls the real authentication routes and checks the captured verification, password-reset, and email-change messages through Mailpit's API. It fails early if Mailpit is unavailable.

## Troubleshooting

- **Container does not start:** Check Docker availability with `docker info`, inspect `docker compose --profile email-testing logs mailpit`, and confirm the image can be pulled.
- **Docker CLI targets an unavailable Podman socket:** On this workstation `DOCKER_HOST` and the default Docker context point to a missing Podman socket. If that is still the case, use `env -u DOCKER_HOST docker --host unix:///var/run/docker.sock compose --profile email-testing up -d mailpit` to start Mailpit and `env -u DOCKER_HOST docker --host unix:///var/run/docker.sock compose --profile email-testing down` to stop it. Otherwise use the standard commands above with your active Docker Compose runtime.
- **SMTP connection refused:** Confirm the container is running and healthy (`docker compose --profile email-testing ps`), and that the backend uses port `1025` with `SMTP_SECURE=false`.
- **Incorrect SMTP hostname:** A host-run backend must use `127.0.0.1`. A backend container on the same Compose network must use `mailpit`.
- **Port conflict:** Check whether ports `1025` or `8025` are already in use, stop the conflicting local service, or coordinate an alternate local-only port mapping and update `SMTP_PORT` to match.
- **Backend inside versus outside Docker:** `127.0.0.1` means the current machine for a host process, but means the backend container itself for a containerized process. This project has no existing backend Compose service.
- **No message appears:** Confirm `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM`, and `APP_BASE_URL` are set in the backend process environment; make sure no SMTP authentication variables are configured for Mailpit. Check the backend's delivery-failure logs and Mailpit's container logs.
- **Check SMTP without sending a message:** Run `npm run email:diagnose` from `backend` with the local Mailpit settings above. The command reports a safe diagnostic category and never prints credentials.
