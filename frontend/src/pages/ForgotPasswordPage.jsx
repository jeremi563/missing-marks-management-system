import { useState } from 'react'
import { ArrowLeft, ArrowRight, GraduationCap, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import { requestPasswordReset } from '../api/auth'
import './PasswordRecovery.css'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')
    try {
      await requestPasswordReset(email.trim())
      setRequestSent(true)
    } catch {
      setError('We could not process your request right now. Please try again later.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page password-recovery-page">
      <Link to="/login" className="back-link"><ArrowLeft size={16} /> Back to sign in</Link>
      <section className="auth-card password-recovery-card">
        <Link to="/" className="public-brand"><span className="brand-icon"><GraduationCap size={21} /></span>Missing Marks</Link>
        {requestSent ? (
          <div className="password-recovery-result" role="status" aria-live="polite">
            <span className="password-recovery-icon"><Mail size={21} /></span>
            <p className="eyebrow">CHECK YOUR INBOX</p>
            <h1>Reset instructions requested</h1>
            <p className="auth-intro">If an account exists for this email address, password reset instructions will arrive shortly. Check your inbox and spam folder.</p>
            <Link className="button button-primary button-full" to="/login">Return to sign in <ArrowRight size={17} /></Link>
          </div>
        ) : (
          <>
            <p className="eyebrow">ACCOUNT RECOVERY</p>
            <h1>Forgot your password?</h1>
            <p className="auth-intro">Enter the email address associated with your account. We will send a secure reset link if it matches an active account.</p>
            {error && <div className="form-alert" role="alert">{error}</div>}
            <form onSubmit={submit}>
              <label htmlFor="recovery-email">Email address</label>
              <input
                id="recovery-email"
                type="email"
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                maxLength={254}
                required
              />
              <button className="button button-primary button-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Sending…' : <>Send reset link <ArrowRight size={17} /></>}
              </button>
            </form>
            <p className="auth-switch"><Link to="/login">Return to sign in</Link></p>
          </>
        )}
      </section>
    </main>
  )
}