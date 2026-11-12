import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, GraduationCap, ShieldCheck } from 'lucide-react'
import { verifyEmail } from '../api/auth'
import { useAuth } from '../auth/useAuth'

function getSettingsPath(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [user?.role]
  if (roles.includes('administrator')) return '/admin/account-settings'
  if (roles.includes('cod')) return '/cod/settings'
  if (roles.includes('lecturer')) return '/lecturer/settings'
  return '/student/settings'
}

export default function EmailVerificationPage() {
  const [searchParams] = useSearchParams()
  const { isAuthenticated, refreshUser, user } = useAuth()
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const token = searchParams.get('token') || ''

  const confirmEmail = async (event) => {
    event.preventDefault()
    setStatus('loading')
    setError('')
    try {
      await verifyEmail(token)
      if (isAuthenticated) await refreshUser()
      setStatus('success')
    } catch (requestError) {
      setError(requestError.userMessage || 'This verification link is invalid or has expired.')
      setStatus('error')
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card email-verification-card">
        <Link to="/" className="public-brand"><span className="brand-icon"><GraduationCap size={21} /></span>Missing Marks</Link>
        <p className="eyebrow">EMAIL SECURITY</p>
        <h1>{status === 'success' ? 'Email address confirmed' : 'Confirm your email address'}</h1>
        {status === 'success' ? (
          <>
            <p className="auth-intro">Your email address has been verified and updated. You can continue to your account settings.</p>
            <Link className="button button-primary button-full" to={isAuthenticated ? getSettingsPath(user) : '/login'}>
              <Check size={17} /> {isAuthenticated ? 'Return to account settings' : 'Continue to sign in'}
            </Link>
          </>
        ) : (
          <>
            <p className="auth-intro">Confirm the address change using the secure link sent to your new email.</p>
            {error && <div className="form-alert" role="alert">{error}</div>}
            <form onSubmit={confirmEmail}>
              <button className="button button-primary button-full" type="submit" disabled={!token || status === 'loading'}>
                <ShieldCheck size={17} /> {status === 'loading' ? 'Confirming…' : 'Confirm email address'}
              </button>
            </form>
            {!token && <p className="form-alert" role="alert">This link is missing its verification token.</p>}
            <p className="auth-switch"><Link to="/login">Return to sign in</Link></p>
          </>
        )}
      </section>
    </main>
  )
}