# Frontend

React single-page application for students, lecturers, CODs and administrators.

> **Status:** not started. Development begins after the Phase 1 API is stable (after `v0.1.0`) and runs in parallel with Phase 2 backend work. Until then this folder only holds this plan.

## Stack (agreed baseline)

| Concern | Choice |
|---|---|
| Framework | React (Vite build tool — to be confirmed at kick-off) |
| Routing | React Router |
| HTTP | Axios with one shared client + interceptors |
| Styling | Plain CSS or CSS Modules (responsive: desktop, tablet, mobile) |
| State | `useState`, `useContext`, custom hooks — **no** Redux, Zustand or TanStack Query initially |
| Tests | Manual browser checks (desktop + mobile viewport); component tests only if time allows |

## Planned structure

```
frontend/
├── src/
│   ├── api/            # axios client, one file per backend module
│   ├── auth/           # AuthContext, ProtectedRoute, role guards
│   ├── components/     # shared UI: Button, Table, Pagination, StatusBadge, Timeline, Alert...
│   ├── layouts/        # PublicLayout, StudentLayout, StaffLayout, AdminLayout
│   ├── pages/          # public/, student/, lecturer/, cod/, admin/
│   ├── hooks/          # useAuth, usePagination, useApi...
│   ├── styles/
│   └── main.jsx
└── README.md
```

## Routes (proposed)

- **Public:** `/`, `/login`, `/register`, `/forgot-password`, `/help`
- **Student:** `/student/dashboard`, `/student/reports`, `/student/reports/new`, `/student/reports/:id`, `/student/reports/:id/appeal`, `/student/attendance`, `/student/attendance-history`, `/student/cat-submissions`, `/student/notifications`, `/student/profile`
- **Lecturer:** `/lecturer/dashboard`, `/lecturer/reports`, `/lecturer/reports/:id`, `/lecturer/attendance-sessions[/new]`, `/lecturer/attendance-history`, `/lecturer/attendance-discrepancies`, `/lecturer/assessments`, `/lecturer/cat-submissions`, `/lecturer/examination-attendance`
- **COD:** `/cod/dashboard`, `/cod/reports[/:id]`, `/cod/appeals`, `/cod/attendance-discrepancies`, `/cod/reports-and-exports`
- **Admin:** `/admin/dashboard`, `/admin/users`, `/admin/departments`, `/admin/units`, `/admin/enrollments`, `/admin/assignments`, `/admin/settings`, `/admin/audit-logs`, `/admin/notifications`, `/admin/archives`, `/admin/reports`

Route names may change; module and permission boundaries may not.

## Rules for working with the API
1. The contract in `docs/design/api-contracts.md` (and OpenAPI) is the only source of truth for request/response shapes.
2. Authentication uses HttpOnly cookies: Axios must send credentials; never store tokens in `localStorage`.
3. Route guards are for convenience only — the backend decides. Use the report `allowedActions` field instead of re-implementing workflow rules in React.
4. Centralise error handling: Axios interceptor → standard error shape → friendly message. Never show raw backend errors.
5. Always handle loading, empty, success and error states; forms show field-level validation from `error.details`.
6. Never display attendance success before the server confirms it.
7. Accessibility basics: labels, keyboard navigation, contrast, clear error text.

## Setup *(planned)*
```bash
cd frontend
npm install
cp .env.example .env     # VITE_API_BASE_URL=http://localhost:4000/api/v1
npm run dev              # http://localhost:5173
```
Requires the backend running with `FRONTEND_URL=http://localhost:5173` for CORS.

## First frontend tasks (when started)
1. Vite + React Router + Axios client + AuthContext + protected routes.
2. Login/register pages, role-based redirect.
3. Student: submit report, list, detail + timeline, appeal.
4. Staff: lecturer queue/detail and decision; COD queue/detail and decision.
5. Notifications dropdown/page.
