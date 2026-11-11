import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import LoadingPage from '../pages/LoadingPage'

export default function RequireRole({ allowedRoles }) {
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
  if (!allowedRoles.some((role) => roles.includes(role))) {
    return <Navigate to="/403" replace />
  }
  return <Outlet />
}
