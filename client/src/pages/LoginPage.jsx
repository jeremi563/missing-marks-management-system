import { useState } from 'react'
import { getApiErrorMessage } from '../api/errorHandler'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LockKeyhole, Mail, ArrowRight } from 'lucide-react'

import { useAuth } from '../auth/useAuth'
import LoadingPage from './LoadingPage'
import '../styles/LoginPage.css'

const roleDestinations = {
  student: {
    label: 'Student Portal',
    path: '/student',
  },
  lecturer: {
    label: 'Lecturer Portal',
    path: '/lecturer',
  },
  cod: {
    label: 'COD Portal',
    path: '/cod',
  },
  administrator: {
    label: 'Administrator Portal',
    path: '/admin',
  },
}

function LoginPage() {
  const { user, login, isLoading, isAuthenticated, authError } = useAuth()

  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const userRoles = Array.isArray(user?.roles)
    ? user.roles.filter((role) => roleDestinations[role])
    : []

  const requestedPath = location.state?.from?.pathname

  const getDestination = (role) => {
    const defaultPath = roleDestinations[role]?.path

    if (
      requestedPath &&
      (requestedPath === defaultPath ||
        requestedPath.startsWith(`${defaultPath}/`))
    ) {
      return requestedPath
    }

    return defaultPath || '/'
  }

  if (isLoading) {
    return <LoadingPage />
  }

  if (isAuthenticated && userRoles.length === 1) {
    return (
      <Navigate
        to={getDestination(userRoles[0])}
        replace
      />
    )
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('Please enter your email and password.')
      return
    }

    try {
      setIsSubmitting(true)

      const authenticatedUser = await login({
        email: email.trim(),
        password,
      })

      const roles = Array.isArray(authenticatedUser.roles)
        ? authenticatedUser.roles.filter(
            (role) => roleDestinations[role]
          )
        : []

      if (roles.length === 0) {
        setError('Your account does not have an assigned portal.')
        return
      }

      if (roles.length === 1) {
        navigate(getDestination(roles[0]), { replace: true })
      }
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRoleSelection = (role) => {
    navigate(getDestination(role), { replace: true })
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="login-brand-icon">
            <LockKeyhole size={25} />
          </div>

          <h1>Missing Marks</h1>
          <p>Management System</p>
        </div>

        {isAuthenticated && userRoles.length > 1 ? (
          <div className="role-selection">
            <h2>Select your portal</h2>
            <p>Your account has access to multiple portals.</p>

            {userRoles.map((role) => (
              <button
                key={role}
                className="role-option"
                onClick={() => handleRoleSelection(role)}
              >
                <span>{roleDestinations[role].label}</span>
                <ArrowRight size={18} />
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="login-heading">
              <h2>Welcome back</h2>
              <p>Sign in to access your account.</p>
            </div>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            {!error && authError && (
              <div className="login-error" role="alert">
                {authError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="login-field">
                <label htmlFor="email">Email address</label>

                <div className="login-input-wrapper">
                  <Mail size={19} />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your email"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="password">Password</label>

                <div className="login-input-wrapper">
                  <LockKeyhole size={19} />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="login-submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Signing in...' : 'Sign in'}
                {!isSubmitting && <ArrowRight size={18} />}
              </button>
            </form>
          </>
        )}

        <p className="login-footer">
          Missing Marks Management System
        </p>
      </section>
    </main>
  )
}

export default LoginPage