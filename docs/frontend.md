
# Missing Marks Management System — Frontend Foundation

## 1. Overview

The frontend foundation for the SOEN370 Web-Based Missing Marks Management System has been established using React and Vite.

The work focused on shared features that can be reused across the Student, Lecturer, COD and Administrator portals.

## 2. Technologies Used

- React
- Vite
- JavaScript
- React Router
- Axios
- Lucide React
- CSS

## 3. Project Structure

```text
client/
└── src/
    ├── api/
    │   ├── admin.js
    │   ├── auth.js
    │   ├── client.js
    │   ├── cod.js
    │   ├── errorHandler.js
    │   ├── lecturer.js
    │   └── student.js
    │
    ├── auth/
    │   ├── AuthContext.jsx
    │   ├── RequireRole.jsx
    │   └── useAuth.js
    │
    ├── components/
    │   ├── navigation/
    │   │   ├── Sidebar.jsx
    │   │   └── Topbar.jsx
    │   │
    │   └── ui/
    │       ├── CharCounter.jsx
    │       ├── ConfirmDialog.jsx
    │       ├── EmptyState.jsx
    │       ├── ErrorState.jsx
    │       ├── FormField.jsx
    │       ├── LoadingState.jsx
    │       ├── Pager.jsx
    │       ├── StatusChip.jsx
    │       └── Timeline.jsx
    │
    ├── config/
    │   └── navigation.js
    │
    ├── features/
    │   └── shared/
    │       └── DashboardHome.jsx
    │
    ├── layouts/
    │   ├── DashboardLayout.css
    │   └── DashboardLayout.jsx
    │
    ├── pages/
    │   ├── AccessDenied.jsx
    │   ├── LandingPage.jsx
    │   ├── LoadingPage.jsx
    │   ├── LoginPage.jsx
    │   └── NotFound.jsx
    │
    ├── styles/
    │   ├── auth.css
    │   ├── components.css
    │   ├── global.css
    │   ├── LandingPage.css
    │   └── variables.css
    │
    ├── App.css
    ├── App.jsx
    └── main.jsx
```

## 4. Completed Work

### 4.1 Application Setup
- Initialized the React application using Vite.
- Organized the frontend source files into folders.
- Configured the application entry point in `main.jsx`.
- Configured application routing in `App.jsx`.

### 4.2 Authentication
- Created the shared Axios client.
- Implemented login and logout API functions.
- Implemented current-user retrieval.
- Created `AuthContext` for managing authentication state.
- Created `useAuth` for accessing authentication information.
- Implemented session restoration.
- Implemented role-based route protection using `RequireRole`.
- Created the login page.

### 4.3 Navigation and Layout
- Created the landing page.
- Created the shared dashboard layout.
- Implemented the sidebar.
- Implemented the topbar.
- Created navigation configuration for all four roles.
- Added protected portal routes for Student, Lecturer, COD and Admin.
- Created access-denied and not-found pages.
- Added responsive navigation styling.

### 4.4 API Communication
- Created a shared Axios instance in `api/client.js`.
- Configured the API base URL.
- Enabled cookie-based authentication using `withCredentials`.
- Created separate API files for Student, Lecturer, COD and Admin.
- Implemented centralized API error handling.
- Added field-level validation error extraction.

### 4.5 Shared UI Components

Created the following reusable components:

| Component | Purpose |
|---|---|
| `StatusChip` | Displays formatted status labels. |
| `Pager` | Provides pagination controls. |
| `Timeline` | Displays chronological events. |
| `ConfirmDialog` | Displays action confirmation dialogs. |
| `CharCounter` | Displays text input character counts. |
| `FormField` | Provides consistent form field structure. |
| `LoadingState` | Displays loading indicators. |
| `EmptyState` | Displays messages when no records exist. |
| `ErrorState` | Displays errors and optional retry actions. |

### 4.6 Shared Styling
Created and organized the following stylesheets:

- `variables.css` — shared CSS variables.
- `global.css` — global styles and resets.
- `components.css` — reusable component styles.
- `auth.css` — authentication page styles.
- `LandingPage.css` — landing page styles.
- `DashboardLayout.css` — dashboard layout styles.
- `App.css` — application-level styles.

## 5. Verification

The following checks were performed:

```bash
cd client
npm run build
```

<badge color="success">Build successful</badge>

The source structure was inspected using:

```bash
find src -maxdepth 3 -type f | sort
```

Git changes were inspected using:

```bash
git status --short
git diff --check
```

## 6. Current Status

The shared frontend foundation has been implemented.

Completed areas:

- React and Vite setup.
- Application routing.
- Authentication foundation.
- Role-based access protection.
- Shared dashboard layout.
- Navigation components.
- API communication layer.
- Centralized error handling.
- Reusable UI components.
- Shared styling system.
- Successful production build.