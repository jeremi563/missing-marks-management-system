import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, KeyRound } from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { getPostLoginDestination } from '../auth/role-navigation'
import { meetsPasswordPolicy, PASSWORD_POLICY_MESSAGE } from '../auth/password-policy'
import { changePassword } from '../api/auth'
import '../styles/AuthPages.css'

export default function FirstLoginPasswordChange() {
  const { refreshUser, user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (!meetsPasswordPolicy(newPassword)) {
      setError(PASSWORD_POLICY_MESSAGE)
      return
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.')
      return
    }
    if (newPassword === currentPassword) {
      setError('Choose a password different from your temporary password.')
      return
    }

    setSubmitting(true)
    try {
      await changePassword(currentPassword, newPassword)
      const refreshedUser = await refreshUser()
      const destination = getPostLoginDestination(refreshedUser, location.state?.from)
      navigate(destination, { replace: true })
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to update your password. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="brand-icon"><KeyRound size={20} /></span>
        <p className="eyebrow">SECURE YOUR ACCOUNT</p>
        <h1>Choose a new password</h1>
        <p>Your first sign-in used your registration number as a temporary password. Replace it now before continuing.</p>
        {error && <div className="form-alert" role="alert">{error}</div>}
        <form onSubmit={submit}>
          <label htmlFor="temporary-password">Temporary password</label>
          <input
            id="temporary-password"
            type={showPasswords ? 'text' : 'password'}
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type={showPasswords ? 'text' : 'password'}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
          />
          <label htmlFor="confirm-new-password">Confirm new password</label>
          <input
            id="confirm-new-password"
            type={showPasswords ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
          />
          <small className="field-hint">{PASSWORD_POLICY_MESSAGE}</small>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => setShowPasswords((visible) => !visible)}
            aria-pressed={showPasswords}
          >
            {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
            {showPasswords ? 'Hide passwords' : 'Show passwords'}
          </button>
          <button className="button button-primary button-full" disabled={submitting}>
            {submitting ? 'Updating password…' : 'Set new password'}
          </button>
        </form>
        <p className="field-hint">Signed in as {user?.email || 'your student account'}.</p>
      </section>
    </main>
  )
}
