import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { getPostLoginDestination } from '../auth/role-navigation'
import '../styles/AuthPages.css'
import './LoginPage.css'

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [accountType, setAccountType] = useState('student')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { login, isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (isAuthenticated) {
    if (user?.mustChangePassword) return <Navigate to="/change-password" replace />
    if (user?.approvalStatus === 'PENDING' && user?.roles?.includes('lecturer')) {
      return <Navigate to="/lecturer-department-registration" replace />
    }
    return <Navigate to={getPostLoginDestination(user)} replace />
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const authenticatedUser = await login({ identifier: identifier.trim(), password, accountType })
      if (authenticatedUser?.mustChangePassword) {
        navigate('/change-password', { replace: true, state: location.state })
        return
      }
      if (authenticatedUser?.approvalStatus === 'PENDING' && authenticatedUser?.roles?.includes('lecturer')) {
        navigate('/lecturer-department-registration', { replace: true })
        return
      }
      const destination = getPostLoginDestination(authenticatedUser, location.state?.from)
      navigate(destination, { replace: true })
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to sign in. Check your credentials and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page login-page">
      <div className="login-shell">
        <aside className="login-visual" aria-label="Kisii University">
          <img src="/images/Kisii-logo.png" alt="Kisii University logo" />
          <p>Missing Marks</p>
          <span>Academic support portal</span>
        </aside>
        <section className="auth-card login-card">
          <h1>Sign in to your account</h1>
          <p className="login-intro">Use your registration or staff number to continue.</p>
          <div className="login-account-tabs" role="group" aria-label="Account type">
            <button
              type="button"
              className={accountType === 'student' ? 'active' : ''}
              aria-pressed={accountType === 'student'}
              onClick={() => setAccountType('student')}
            >
              Student
            </button>
            <button
              type="button"
              className={accountType === 'staff' ? 'active' : ''}
              aria-pressed={accountType === 'staff'}
              onClick={() => setAccountType('staff')}
            >
              Staff
            </button>
          </div>
          {error && <div className="form-alert" role="alert">{error}</div>}
          <form onSubmit={submit}>
            <label htmlFor="login-identifier">
              {accountType === 'student' ? 'Registration number' : 'Staff number'}
            </label>
            <div className={`login-input-wrap${identifier ? ' has-value' : ''}`}>
              {!identifier && <UserRound className="login-input-icon" size={18} aria-hidden="true" />}
              <input className="login-input" id="login-identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" maxLength={100} required />
            </div>
            <div className="login-password-label-row">
              <label htmlFor="login-password">Password</label>
            </div>
            <div className={`auth-password-field login-input-wrap${password ? ' has-value' : ''}`}>
              {!password && <LockKeyhole className="login-input-icon" size={18} aria-hidden="true" />}
              <input className="login-input" id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" maxLength={128} required />
            <button
              className="auth-password-toggle"
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            </div>
            <Link className="login-forgot-link" to="/forgot-password">Forgot password?</Link>
            <button className="button button-primary button-full login-submit" disabled={submitting}>
              {submitting ? 'Signing in…' : <>Sign in <ArrowRight size={17} /></>}
            </button>
          </form>
          <p className="auth-switch login-switch">New to Missing Marks? <Link to="/register">Create an account</Link></p>
        </section>
      </div>
    </main>
  )
}
