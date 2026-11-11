import { useState } from 'react'
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react'
import { changePassword } from '../../api/auth'

const initialForm = { currentPassword: '', newPassword: '', confirmPassword: '' }

export default function AccountSettings({ roleLabel }) {
  const [form, setForm] = useState(initialForm)
  const [showPasswords, setShowPasswords] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const update = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (form.newPassword.length < 8) {
      setError('Your new password must be at least 8 characters.')
      return
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('The new passwords do not match.')
      return
    }
    if (form.currentPassword === form.newPassword) {
      setError('Choose a new password different from your current password.')
      return
    }

    setSaving(true)
    try {
      await changePassword(form.currentPassword, form.newPassword)
      setForm(initialForm)
      setSuccess('Your password has been updated.')
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to change your password. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="account-settings">
      <header className="page-heading">
        <div>
          <p className="eyebrow">ACCOUNT</p>
          <h2>Account settings</h2>
          <p>Manage your {roleLabel.toLowerCase()} account security.</p>
        </div>
      </header>
      <section className="panel settings-security-card">
        <div className="settings-card-heading">
          <span className="settings-icon"><KeyRound size={20} /></span>
          <div>
            <h3>Change password</h3>
            <p>Confirm your current password before choosing a new one.</p>
          </div>
        </div>
        {error && <div className="form-alert" role="alert">{error}</div>}
        {success && <div className="form-success" role="status">{success}</div>}
        <form className="settings-password-form" onSubmit={submit}>
          <div className="form-field">
            <label htmlFor="current-password">Current password</label>
            <input id="current-password" name="currentPassword" type={showPasswords ? 'text' : 'password'} value={form.currentPassword} onChange={update} autoComplete="current-password" required />
          </div>
          <div className="form-field">
            <label htmlFor="new-password">New password</label>
            <input id="new-password" name="newPassword" type={showPasswords ? 'text' : 'password'} value={form.newPassword} onChange={update} autoComplete="new-password" minLength={8} maxLength={128} required />
          </div>
          <div className="form-field">
            <label htmlFor="confirm-new-password">Confirm new password</label>
            <input id="confirm-new-password" name="confirmPassword" type={showPasswords ? 'text' : 'password'} value={form.confirmPassword} onChange={update} autoComplete="new-password" minLength={8} maxLength={128} required />
          </div>
          <label className="settings-show-password">
            <input type="checkbox" checked={showPasswords} onChange={(event) => setShowPasswords(event.target.checked)} />
            {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
            Show passwords
          </label>
          <button className="button button-primary" type="submit" disabled={saving}>
            <ShieldCheck size={17} /> {saving ? 'Updating password…' : 'Update password'}
          </button>
        </form>
        <p className="field-hint">Use at least 8 characters. Your password is never shown or stored in plain text.</p>
      </section>
    </section>
  )
}
