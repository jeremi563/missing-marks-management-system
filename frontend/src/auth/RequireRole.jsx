import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import LoadingPage from '../pages/LoadingPage'

export default function RequireRole({ allowedRoles, allowPendingRegistration = false }) {
  const { user, isLoading, isAuthenticated, authError } = useAuth()
  const location = useLocation()

  if (isLoading) return <LoadingPage />
  if (authError) {
    return (
      <main className="status-page">
        <h1>Unable to verify your session</h1>
        <p>{authError}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </main>
    )
  }
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />

  const roles = Array.isArray(user.roles) ? user.roles : [user.role].filter(Boolean)
  const isPendingLecturer = user?.approvalStatus === 'PENDING' && roles.includes('lecturer')

  if (allowPendingRegistration) {
    if (!roles.includes('lecturer')) return <Navigate to="/403" replace />
    if (user?.approvalStatus === 'APPROVED') return <Navigate to="/lecturer" replace />
    if (user?.approvalStatus !== 'PENDING') return <Navigate to="/login" replace />
    return <Outlet />
  }

  if (isPendingLecturer && location.pathname !== '/lecturer-department-registration') {
    return <Navigate to="/lecturer-department-registration" replace />
  }
  if (user?.approvalStatus !== 'APPROVED' && roles.some((role) => ['student', 'lecturer', 'cod', 'administrator'].includes(role)) && location.pathname !== '/lecturer-department-registration') {
    return <Navigate to="/login" replace />
  }
  if (!allowedRoles.some((role) => roles.includes(role))) {
    return <Navigate to="/403" replace />
  }
  return <Outlet />
}
