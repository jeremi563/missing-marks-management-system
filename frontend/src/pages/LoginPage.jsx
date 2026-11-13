import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Eye, EyeOff, GraduationCap, LockKeyhole, UserRound } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import './LoginPage.css'

function getRole(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [user?.role]
  if (roles.includes('administrator')) return 'admin'
  if (roles.includes('cod')) return 'cod'
  return roles.find(Boolean)
}

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
    return <Navigate to={`/${getRole(user) || 'student'}`} replace />
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const authenticatedUser = await login({ identifier: identifier.trim(), password })
      if (authenticatedUser?.mustChangePassword) {
        navigate('/change-password', { replace: true })
        return
      }
      if (authenticatedUser?.approvalStatus === 'PENDING' && authenticatedUser?.roles?.includes('lecturer')) {
        navigate('/lecturer-department-registration', { replace: true })
        return
      }
      const returnPath = location.state?.from
      const destination = returnPath?.pathname
        ? `${returnPath.pathname}${returnPath.search || ''}${returnPath.hash || ''}`
        : `/${getRole(authenticatedUser) || 'student'}`
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
        <Link to="/" className="back-link login-back"><ArrowLeft size={16} /> Back home</Link>
        <aside className="login-visual" aria-hidden="true">
          <div className="login-visual-orbit login-visual-orbit-outer" />
          <div className="login-visual-orbit login-visual-orbit-inner" />
          <div className="login-visual-mark"><GraduationCap size={54} strokeWidth={1.4} /></div>
          <span className="login-visual-line login-visual-line-one" />
          <span className="login-visual-line login-visual-line-two" />
        </aside>
        <section className="auth-card login-card">
          <Link to="/" className="public-brand"><span className="brand-icon"><GraduationCap size={21} /></span>Missing Marks</Link>
          <p className="eyebrow">WELCOME BACK</p>
          <h1>Sign in to your account</h1>
          {error && <div className="form-alert" role="alert">{error}</div>}
          <form onSubmit={submit}>
            <label htmlFor="login-identifier">Registration or staff number</label>
            <div className="login-input-wrap">
              <UserRound className="login-input-icon" size={18} aria-hidden="true" />
              <input className="login-input" id="login-identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" maxLength={100} required />
            </div>
            <div className="login-password-label-row">
              <label htmlFor="login-password">Password</label>
              <Link to="/forgot-password">Forgot password?</Link>
            </div>
            <div className="auth-password-field login-input-wrap">
              <LockKeyhole className="login-input-icon" size={18} aria-hidden="true" />
              <input className="login-input" id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
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
            <button className="button button-primary button-full login-submit" disabled={submitting}>
              {submitting ? 'Signing in…' : <>Sign in <ArrowRight size={17} /></>}
            </button>
          </form>
          <p className="field-hint">Students: use your registration number as both your login number and temporary password on first sign-in.</p>
          <p className="auth-switch login-switch">Lecturer? <Link to="/register">Register your account</Link></p>
        </section>
      </div>
    </main>
  )
}
