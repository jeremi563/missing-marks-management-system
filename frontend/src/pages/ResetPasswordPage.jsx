import { useState } from 'react'
import { ArrowLeft, Check, Eye, EyeOff, GraduationCap, LockKeyhole } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../api/auth'
import './PasswordRecovery.css'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('The passwords do not match. Enter the same password in both fields.')
      return
    }
    setIsSubmitting(true)
    try {
      await resetPassword(token, password)
      setIsComplete(true)
    } catch (requestError) {
      setError(requestError.userMessage || 'This reset link is invalid or has expired. Request a new link to continue.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page password-recovery-page">
      <Link to="/login" className="back-link"><ArrowLeft size={16} /> Back to sign in</Link>
      <section className="auth-card password-recovery-card">
        <Link to="/" className="public-brand"><span className="brand-icon"><GraduationCap size={21} /></span>Missing Marks</Link>
        {isComplete ? (
          <div className="password-recovery-result" role="status" aria-live="polite">
            <span className="password-recovery-icon"><Check size={21} /></span>
            <p className="eyebrow">PASSWORD UPDATED</p>
            <h1>You can sign in now</h1>
            <p className="auth-intro">Your password has been changed and other active sessions have been signed out.</p>
            <Link className="button button-primary button-full" to="/login">Continue to sign in</Link>
          </div>
        ) : (
          <>
            <p className="eyebrow">ACCOUNT RECOVERY</p>
            <h1>Choose a new password</h1>
            {!token ? (
              <>
                <p className="form-alert" role="alert">This reset link is missing its security token.</p>
                <Link className="button button-primary button-full" to="/forgot-password">Request a new reset link</Link>
              </>
            ) : (
              <>
                <p className="auth-intro">Choose a new password with at least 8 characters. Your other active sessions will be signed out.</p>
                {error && <div className="form-alert" role="alert">{error}</div>}
                <form onSubmit={submit}>
                  <label htmlFor="reset-password">New password</label>
                  <div className="auth-password-field">
                    <LockKeyhole className="recovery-password-icon" size={17} aria-hidden="true" />
                    <input
                      id="reset-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      required
                    />
                    <button className="auth-password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <label htmlFor="reset-confirm-password">Confirm new password</label>
                  <div className="auth-password-field">
                    <LockKeyhole className="recovery-password-icon" size={17} aria-hidden="true" />
                    <input
                      id="reset-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      maxLength={128}
                      required
                    />
                    <button className="auth-password-toggle" type="button" aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showConfirmPassword} onClick={() => setShowConfirmPassword((visible) => !visible)}>
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <small className="field-hint">Use at least 8 characters.</small>
                  <button className="button button-primary button-full" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Updating password…' : 'Update password'}
                  </button>
                </form>
              </>
            )}
          </>
        )}
      </section>
    </main>
  )
}