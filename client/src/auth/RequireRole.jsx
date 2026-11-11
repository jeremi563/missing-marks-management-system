
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import LoadingPage from '../pages/LoadingPage'

function RequireRole({ allowedRoles }) {
  const { user, isLoading, isAuthenticated, authError } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <LoadingPage />
  }

  if (authError) {
    return (
      <main className="status-page">
        <h2>Unable to verify your session</h2>
        <p>{authError}</p>
        <button onClick={() => window.location.reload()}>
          Retry
        </button>
      </main>
    )
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    )
  }

  const userRoles = Array.isArray(user.roles) ? user.roles : []

  const hasPermission = allowedRoles.some((role) =>
    userRoles.includes(role)
  )

  if (!hasPermission) {
    return <Navigate to="/403" replace />
  }

  return <Outlet />
}

export default RequireRole