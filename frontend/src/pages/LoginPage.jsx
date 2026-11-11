import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, GraduationCap } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import ThemeToggle from '../components/ui/ThemeToggle'

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

  if (isAuthenticated) return <Navigate to={`/${getRole(user) || 'student'}`} replace />

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const authenticatedUser = await login({ identifier: identifier.trim(), password })
      const destination = location.state?.from?.pathname || `/${getRole(authenticatedUser) || 'student'}`
      navigate(destination, { replace: true })
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to sign in. Check your credentials and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <Link to="/" className="back-link"><ArrowLeft size={16} /> Back home</Link>
      <section className="auth-card">
        <div className="auth-theme-toggle"><ThemeToggle /></div>
        <Link to="/" className="public-brand"><span className="brand-icon"><GraduationCap size={21} /></span>Missing Marks</Link>
        <p className="eyebrow">WELCOME BACK</p><h1>Sign in to your account</h1>
        <p className="auth-intro">Use your registration number and password. Lecturers can sign in after their department's COD approves the application; email verification is not required.</p>
        {error && <div className="form-alert" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <label htmlFor="login-identifier">Registration number</label>
          <input id="login-identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" maxLength={100} required />
          <small className="field-hint">Student: AB/01243/year. Staff: AB/0123/staffnumber. Administrator: admin/12/year.</small>
          <label htmlFor="login-password">Password</label>
          <div className="auth-password-field">
            <input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
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
          <button className="button button-primary button-full" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="auth-switch">New here? <Link to="/register">Create an account</Link></p>
        <p className="auth-switch">Lecturer account created but department form not completed? <Link to="/lecturer-department-registration">Complete lecturer registration</Link></p>
      </section>
    </main>
  )
}
