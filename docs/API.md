# API Contract and Conventions

## 1. Purpose and status

This document defines the initial REST API conventions and proposed role-based route layout. The routes below are starting points for team discussion; they are not final until the team confirms request bodies, response fields, permissions and workflow rules.

## 2. Base path

All backend endpoints should be versioned under:

```text
/api/v1
```

Role-based route prefixes:

```text
/api/v1/auth
/api/v1/student
/api/v1/lecturer
/api/v1/cod
/api/v1/admin
```

## 3. HTTP conventions

Use HTTP methods consistently:

- `GET` — retrieve a resource or list.
- `POST` — create a resource or trigger a defined action.
- `PATCH` — partially update a resource.
- `PUT` — replace a resource only where full replacement is intended.
- `DELETE` — delete only where deletion is allowed by the agreed retention policy.

Use plural resource names for collections, for example `/reports`. Use `:id` for a resource identifier.

## 4. Initial route catalogue

### Authentication

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/auth/login` | Authenticate a user. |
| POST | `/api/v1/auth/logout` | End the authenticated session/token where supported. |
| GET | `/api/v1/auth/me` | Return the authenticated user's permitted profile summary. |

Final authentication routes depend on the agreed authentication design.

### Student

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/student/profile` | Get own profile. |
| GET | `/api/v1/student/reports` | List own reports. |
| POST | `/api/v1/student/reports` | Submit a missing-mark report. |
| GET | `/api/v1/student/reports/:id` | View own report details if authorised. |
| PATCH | `/api/v1/student/reports/:id` | Update a report where its status permits. |
| POST | `/api/v1/student/reports/:id/withdraw` | Request/perform withdrawal where permitted. |
| POST | `/api/v1/student/reports/:id/appeals` | Submit an appeal where permitted. |
| GET | `/api/v1/student/attendance` | View own permitted attendance information. |

### Lecturer

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/lecturer/reports` | List reports assigned to the lecturer. |
| GET | `/api/v1/lecturer/reports/:id` | View an assigned report. |
| POST | `/api/v1/lecturer/reports/:id/comments` | Add an investigation comment. |
| POST | `/api/v1/lecturer/reports/:id/approve` | Record an approval where authorised. |
| POST | `/api/v1/lecturer/reports/:id/reject` | Record a rejection with a reason. |
| POST | `/api/v1/lecturer/attendance-sessions` | Create an attendance session. |
| GET | `/api/v1/lecturer/attendance-sessions` | List sessions within lecturer's scope. |

### COD / Academic Officer

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/cod/reports` | List departmental reports. |
| POST | `/api/v1/cod/reports/:id/assign` | Assign or reassign a report where permitted. |
| POST | `/api/v1/cod/reports/:id/approve` | Record a departmental decision where authorised. |
| POST | `/api/v1/cod/reports/:id/reject` | Record a departmental rejection with a reason. |
| GET | `/api/v1/cod/appeals` | List appeals within the authorised scope. |
| GET | `/api/v1/cod/reports/overdue` | List overdue reports. |

### Administrator

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/admin/users` | List users within administrative permissions. |
| POST | `/api/v1/admin/users` | Create a user account. |
| PATCH | `/api/v1/admin/users/:id` | Update permitted account fields. |
| GET | `/api/v1/admin/departments` | List departments. |
| POST | `/api/v1/admin/departments` | Create a department. |
| GET | `/api/v1/admin/reports` | View system-wide report summaries within permissions. |
| GET | `/api/v1/admin/audit-logs` | View permitted audit records. |
| PATCH | `/api/v1/admin/settings` | Update permitted system settings. |

Additional routes for attendance, CAT, examination attendance, notifications, special cases and exports should be added when the team confirms their requirements.

## 5. Authentication and authorisation

- Protected routes must require a valid authenticated identity.
- Role permissions must be checked on the backend.
- Check record ownership and organisational scope, not just the user's role.
- A student must not access another student's report by changing an ID.
- A lecturer must not access reports outside their authorised assignment/scope.
- COD / Academic Officer access must be limited to the agreed department or academic scope.
- Administrative permissions must not be interpreted as permission to change official marks.
- Return an appropriate unauthorised or forbidden response without leaking private record details.

The exact token/session strategy and role model will be documented after the authentication foundation is agreed.

## 6. Response format

Successful response example:

```json
{
  "success": true,
  "message": "Report submitted successfully",
  "data": {
    "id": "resource-uuid"
  }
}
```

Error response example:

```json
{
  "success": false,
  "message": "Report not found"
}
```

The team should agree whether validation details, pagination metadata and error codes will be represented in additional standard fields. Keep the response structure consistent across modules.

## 7. Status codes

Use status codes consistently:

- `200 OK` — successful read or update.
- `201 Created` — resource created.
- `204 No Content` — successful operation with no response body, if used consistently.
- `400 Bad Request` — malformed request or invalid action.
- `401 Unauthorized` — missing or invalid authentication.
- `403 Forbidden` — authenticated user lacks permission.
- `404 Not Found` — resource not found or intentionally not disclosed.
- `409 Conflict` — duplicate or conflicting state.
- `422 Unprocessable Entity` — syntactically valid request that fails business validation, if adopted by the team.
- `500 Internal Server Error` — unexpected server failure.

## 8. Validation and errors

- Validate path parameters, query parameters and request bodies.
- Reject unknown or disallowed fields where appropriate.
- Do not trust role, student ID, lecturer ID or department scope supplied by the client; derive identity and permissions from the authenticated user and database relationships.
- Return useful messages without exposing stack traces, SQL details, secrets or internal implementation information.
- Log technical details safely on the server.

## 9. List endpoints

For list endpoints, agree on pagination before returning potentially large collections. A proposed convention is `page` and `limit`, with a documented maximum limit. Agree on filtering and sorting parameters per endpoint.

## 10. Contract change process

Before changing a route, payload or response:

1. Tell affected module owners.
2. Update this document or the API issue.
3. Identify frontend and backend consumers.
4. Keep changes backward-compatible where practical.
5. Include example requests/responses and tests in the PR.