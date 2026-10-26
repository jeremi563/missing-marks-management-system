# API Documentation

The REST API is versioned under `/api/v1`. Three artefacts describe it — keep them consistent:

| Artefact | Location | Audience | Status |
|---|---|---|---|
| **Human-readable contract** | `docs/design/api-contracts.md` | Developers deciding/reviewing shapes | Primary source during design |
| **OpenAPI 3 specification** | `docs/api/openapi.yaml` *(starter created in T-004)* | Tools, Swagger UI, frontend developers | Must match the code |
| **Postman collection** | `tests/postman/` *(T-004 skeleton, T-127 complete)* | Manual testing and demos | Must replay the MVP journey |

Interactive docs: Swagger UI served by the backend at `http://localhost:4000/api/docs` in non-production environments *(planned)*.

## Workflow
1. Design change → update `api-contracts.md`.
2. Implement → update `openapi.yaml` in the **same PR** (path, params, request/response schemas, error codes, auth requirement).
3. Update the Postman request (with example body and a basic test script).
4. Reviewer checks that code, contract and OpenAPI agree. Drift found at T-128 is fixed before release.

## Conventions (summary — full detail in `api-contracts.md`)
- JSON, camelCase properties, ISO-8601 UTC dates, UUID ids (+ human reference for reports).
- Success: `{ success, message, data, meta? }`. Error: `{ success:false, message, error:{ code, details } }`.
- Pagination: `page`, `limit` (max 100), `sort`, `order`; server-side filtering.
- Auth: HttpOnly cookies (`access_token`, `refresh_token`); no tokens in JSON or localStorage.
- Status codes: 200/201/204/400/401/403/404/409/422/429/500/503 with the error-code list in the contract.

## Using the API manually
1. Start the backend and seed the database.
2. In Postman, use the collection's environment (`baseUrl = http://localhost:4000/api/v1`). Enable cookie handling.
3. `POST /auth/login` as a seeded role; cookies are stored automatically; call other endpoints.
4. Switch role by logging in again (or use separate Postman cookie jars/environments per role).

## OpenAPI authoring tips
- One tag per module (`Auth`, `Reports`, `Appeals`, `Notifications`, `Admin`…).
- Define reusable components: `SuccessEnvelope`, `ErrorEnvelope`, `Pagination`, `Report`, `ReportListItem`, `User`.
- Mark each operation's allowed roles in its description.
- Use `examples` for request bodies to help frontend developers and Postman.

## Versioning policy
`/api/v1` stays stable for the project. Breaking changes need lead approval and a note in the meeting notes; prefer additive changes (new optional fields, new endpoints).
