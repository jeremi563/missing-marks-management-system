import { useState } from 'react'
import { Camera, Check, Eye, EyeOff, KeyRound, Mail, ShieldCheck, Trash2, Upload, UserRound } from 'lucide-react'
import { changePassword, requestEmailChange, updateAvatar } from '../../api/auth'
import { useAuth } from '../../auth/useAuth'

const initialForm = { currentPassword: '', newPassword: '', confirmPassword: '' }
const MAX_AVATAR_BYTES = 512 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function AccountSettings({ roleLabel }) {
  const { user, refreshUser } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [showPasswords, setShowPasswords] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [email, setEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState('')
  const [emailSaving, setEmailSaving] = useState(false)
  const [avatarDraft, setAvatarDraft] = useState(null)
  const [savedAvatar, setSavedAvatar] = useState(undefined)
  const [avatarError, setAvatarError] = useState('')
  const [avatarSuccess, setAvatarSuccess] = useState('')
  const [avatarSaving, setAvatarSaving] = useState(false)

  const update = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const submitPassword = async (event) => {
    event.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')
    if (form.newPassword.length < 8) {
      setPasswordError('Your new password must be at least 8 characters.')
      return
    }
    if (form.newPassword !== form.confirmPassword) {
      setPasswordError('The new passwords do not match.')
      return
    }
    if (form.currentPassword === form.newPassword) {
      setPasswordError('Choose a new password different from your current password.')
      return
    }

    setPasswordSaving(true)
    try {
      await changePassword(form.currentPassword, form.newPassword)
      setForm(initialForm)
      setPasswordSuccess('Your password has been updated.')
    } catch (requestError) {
      setPasswordError(requestError.userMessage || 'Unable to change your password. Please try again.')
    } finally {
      setPasswordSaving(false)
    }
  }

  const submitEmail = async (event) => {
    event.preventDefault()
    setEmailError('')
    setEmailSuccess('')
    setEmailSaving(true)
    try {
      const requestedEmail = email.trim()
      await requestEmailChange(requestedEmail, emailPassword)
      setEmail('')
      setEmailPassword('')
      setEmailSuccess(`Your email address has been updated to ${requestedEmail}.`)
      try {
        await refreshUser()
      } catch {
        setEmailError('Your email address was updated, but your profile could not be refreshed. Reload the page to see the new address.')
      }
    } catch (requestError) {
      setEmailError(requestError.userMessage || 'Unable to change your email. Please try again.')
    } finally {
      setEmailSaving(false)
    }
  }

  const selectAvatar = (event) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setAvatarError('')
    setAvatarSuccess('')
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setAvatarDraft(null)
      setAvatarError('Choose a JPEG, PNG, or WebP image.')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarDraft(null)
      setAvatarError('The image must be 512 KB or smaller.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setAvatarDraft(reader.result)
      else setAvatarError('Unable to read this image. Choose another file.')
    }
    reader.onerror = () => setAvatarError('Unable to read this image. Choose another file.')
    reader.readAsDataURL(file)
  }

  const saveAvatar = async (nextAvatar) => {
    setAvatarError('')
    setAvatarSuccess('')
    setAvatarSaving(true)
    try {
      await updateAvatar(nextAvatar)
      setSavedAvatar(nextAvatar)
      setAvatarDraft(null)
      setAvatarSuccess(nextAvatar ? 'Profile picture updated.' : 'Profile picture removed.')
    } catch (requestError) {
      setAvatarError(requestError.userMessage || 'Unable to update your profile picture. Please try again.')
    } finally {
      setAvatarSaving(false)
    }
  }

  const displayName = user?.displayName || user?.fullName || user?.name || 'Account holder'
  const displayedAvatar = avatarDraft || (savedAvatar === undefined ? user?.avatarData : savedAvatar)

  return (
    <section className="account-settings">
      <header className="page-heading">
        <div>
          <p className="eyebrow">ACCOUNT</p>
          <h2>Account settings</h2>
          <p>Update how your {roleLabel.toLowerCase()} account is reached and secured.</p>
        </div>
      </header>
      <div className="account-settings-grid">
        <section className="panel settings-profile-card" aria-labelledby="settings-profile-title">
          <div className="settings-profile-identity">
            <div className="settings-avatar">
              {displayedAvatar ? <img src={displayedAvatar} alt={`${displayName} profile`} /> : <UserRound size={30} />}
            </div>
            <div className="settings-profile-copy">
              <p className="eyebrow">PROFILE</p>
              <h3 id="settings-profile-title">{displayName}</h3>
              <p>{user?.email || 'No email address available'}</p>
            </div>
          </div>
          <div className="settings-photo-tools">
            <div className="settings-photo-actions">
              <label className="button button-secondary settings-upload-button">
              <Camera size={17} /> Choose photo
                <input id="profile-picture" className="settings-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectAvatar} />
              </label>
              {avatarDraft && <button className="button button-primary" type="button" onClick={() => saveAvatar(avatarDraft)} disabled={avatarSaving}>
                <Upload size={16} /> {avatarSaving ? 'Uploading…' : 'Save photo'}
              </button>}
              {displayedAvatar && !avatarDraft && <button className="button button-secondary" type="button" onClick={() => saveAvatar(null)} disabled={avatarSaving}>
                <Trash2 size={16} /> {avatarSaving ? 'Removing…' : 'Remove photo'}
              </button>}
            </div>
            {(avatarError || avatarSuccess) && <div className="settings-profile-feedback">
              {avatarError && <p className="form-alert" role="alert">{avatarError}</p>}
              {avatarSuccess && <p className="form-success" role="status"><Check size={15} />{avatarSuccess}</p>}
            </div>}
            <p className="settings-photo-hint">JPEG, PNG, or WebP · 512 KB max</p>
          </div>
        </section>

        <section className="panel settings-card" aria-labelledby="settings-email-title">
          <div className="settings-card-heading">
            <span className="settings-icon"><Mail size={20} /></span>
            <div>
              <h3 id="settings-email-title">Email address</h3>
              <p>Your new email address takes effect immediately without email verification.</p>
            </div>
          </div>
          {emailError && <div className="form-alert" role="alert">{emailError}</div>}
          {emailSuccess && <div className="form-success" role="status">{emailSuccess}</div>}
          <form className="settings-form" onSubmit={submitEmail}>
            <div className="form-field">
              <label htmlFor="settings-new-email">New email address</label>
              <input id="settings-new-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required maxLength={254} />
            </div>
            <div className="form-field">
              <label htmlFor="settings-email-password">Current password</label>
              <input id="settings-email-password" type="password" value={emailPassword} onChange={(event) => setEmailPassword(event.target.value)} autoComplete="current-password" required maxLength={128} />
            </div>
            <button className="button button-primary" type="submit" disabled={emailSaving}>
              <Mail size={16} /> {emailSaving ? 'Updating…' : 'Update email'}
            </button>
          </form>
        </section>

        <section className="panel settings-card" aria-labelledby="settings-password-title">
          <div className="settings-card-heading">
            <span className="settings-icon"><KeyRound size={20} /></span>
            <div>
              <h3 id="settings-password-title">Password</h3>
              <p>Confirm your current password before choosing a new one.</p>
            </div>
          </div>
          {passwordError && <div className="form-alert" role="alert">{passwordError}</div>}
          {passwordSuccess && <div className="form-success" role="status">{passwordSuccess}</div>}
          <form className="settings-form" onSubmit={submitPassword}>
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
            <button className="button button-primary" type="submit" disabled={passwordSaving}>
              <ShieldCheck size={17} /> {passwordSaving ? 'Updating password…' : 'Update password'}
            </button>
          </form>
          <p className="field-hint">Use at least 8 characters. Your password is never shown or stored in plain text.</p>
        </section>
      </div>
    </section>
  )
}
