
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import NotFound from './pages/NotFound'
import AccessDenied from './pages/AccessDenied'

import DashboardLayout from './layouts/DashboardLayout'
import DashboardHome from './features/shared/DashboardHome'

import RequireRole from './auth/RequireRole'
import { navigation } from './config/navigation'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public pages */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/403" element={<AccessDenied />} />

        {/* Student portal */}
        <Route element={<RequireRole allowedRoles={['student']} />}>
          <Route
            path="/student"
            element={
              <DashboardLayout
                roleLabel="Student"
                title="Student Dashboard"
                navigationItems={navigation.student}
              />
            }
          >
            <Route
              index
              element={<DashboardHome roleLabel="Student" />}
            />
          </Route>
        </Route>

        {/* Lecturer portal */}
        <Route element={<RequireRole allowedRoles={['lecturer']} />}>
          <Route
            path="/lecturer"
            element={
              <DashboardLayout
                roleLabel="Lecturer"
                title="Lecturer Dashboard"
                navigationItems={navigation.lecturer}
              />
            }
          >
            <Route
              index
              element={<DashboardHome roleLabel="Lecturer" />}
            />
          </Route>
        </Route>

        {/* COD portal */}
        <Route element={<RequireRole allowedRoles={['cod']} />}>
          <Route
            path="/cod"
            element={
              <DashboardLayout
                roleLabel="COD"
                title="COD Dashboard"
                navigationItems={navigation.cod}
              />
            }
          >
            <Route
              index
              element={<DashboardHome roleLabel="COD" />}
            />
          </Route>
        </Route>

        {/* Administrator portal */}
        <Route element={<RequireRole allowedRoles={['administrator']} />}>
          <Route
            path="/admin"
            element={
              <DashboardLayout
                roleLabel="Administrator"
                title="Admin Dashboard"
                navigationItems={navigation.admin}
              />
            }
          >
            <Route
              index
              element={<DashboardHome roleLabel="Administrator" />}
            />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App