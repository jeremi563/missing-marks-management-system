import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, GraduationCap } from 'lucide-react'
import { loginUser, registerUser } from '../api/auth'

export default function RegisterPage() {
  const [form, setForm] = useState({ displayName: '', email: '', registrationNumber: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const navigate = useNavigate()

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    const { displayName, email, registrationNumber, password, confirmPassword } = form
    if (password !== confirmPassword) {
      setError('The passwords do not match. Enter the same password in both fields.')
      setSubmitting(false)
      return
    }
    const normalizedNumber = registrationNumber.trim()
    const studentNumberMatch = /^[A-Za-z]{2}\d{2}\/\d{5}\/(\d{2})$/.exec(normalizedNumber)
    const isStaffNumber = /^[A-Za-z]{2}\/\d{4}\/[A-Za-z0-9-]+$/.test(normalizedNumber)
    if (!studentNumberMatch && !isStaffNumber) {
      setError('Use a student number in the format AB16/00111/26 (admission year 13 through the current year) or a staff number in the format AB/0123/staffnumber.')
      setSubmitting(false)
      return
    }
    if (studentNumberMatch && (Number(studentNumberMatch[1]) < 13 || Number(studentNumberMatch[1]) > new Date().getFullYear() % 100)) {
      setError('A student admission year must be from 13 through the current year.')
      setSubmitting(false)
      return
    }
    const registration = {
      displayName: displayName.trim(),
      email: email.trim(),
      password,
      registrationNumber: normalizedNumber,
    }
    try {
      const result = await registerUser(registration)
      if (!result.data.requiresEmailVerification) {
        if (result.data.requiresDepartmentRegistration) {
          try {
            await loginUser({ identifier: normalizedNumber, password })
          } catch (error) {
            // The user should still be able to complete the pending registration flow manually.
          }
          navigate('/lecturer-department-registration', { replace: true })
          return
        }
        setSuccess('Registration successful. You can now sign in with your registration number and password.')
        window.setTimeout(() => navigate('/login'), 1600)
      } else if (result.data.verificationEmailSent) {
        setSuccess('Registration successful. Check your email and verify your address before signing in with your registration number and password.')
        window.setTimeout(() => navigate('/login'), 1600)
      } else {
        setSuccess('Your registration was saved, but the verification email could not be sent. Contact an administrator before trying to register again.')
      }
    } catch (requestError) {
      const validationDetails = requestError.response?.data?.details
      const validationMessage = Array.isArray(validationDetails)
        ? validationDetails.map(({ message }) => message).filter(Boolean).join(' ')
        : ''
      setError(validationMessage || requestError.userMessage || 'Unable to create your account. Check the information and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <Link to="/" className="back-link"><ArrowLeft size={16} /> Back home</Link>
      <section className="auth-card auth-card-wide">
        <Link to="/" className="public-brand"><span className="brand-icon"><GraduationCap size={21} /></span>Missing Marks</Link>
        <p className="eyebrow">JOIN THE PORTAL</p><h1>Create your account</h1>
        {error && <div className="form-alert" role="alert">{error}</div>}
        {success && <div className="form-success" role="status">{success}</div>}
        <form onSubmit={submit}>
          <label htmlFor="register-name">Full name</label>
          <input id="register-name" name="displayName" value={form.displayName} onChange={update} autoComplete="name" required maxLength={200} />
          <label htmlFor="register-email">Institutional email</label>
          <input id="register-email" name="email" type="email" value={form.email} onChange={update} autoComplete="email" required />
          <label htmlFor="registration-number">Registration or staff number</label>
          <input id="registration-number" name="registrationNumber" value={form.registrationNumber} onChange={update} autoComplete="off" required maxLength={100} />
          <label htmlFor="register-password">Password</label>
          <div className="auth-password-field">
            <input id="register-password" name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={update} autoComplete="new-password" minLength={8} required />
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
          <small className="field-hint">Use at least 8 characters.</small>
          <label htmlFor="register-confirm-password">Confirm password</label>
          <div className="auth-password-field">
            <input id="register-confirm-password" name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={update} autoComplete="new-password" minLength={8} required />
            <button
              className="auth-password-toggle"
              type="button"
              aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
              aria-pressed={showConfirmPassword}
              onClick={() => setShowConfirmPassword((visible) => !visible)}
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <button className="button button-primary button-full" disabled={submitting}>{submitting ? 'Creating account…' : 'Create account'}</button>
        </form>
        <p className="auth-switch">Already registered? <Link to="/login">Sign in</Link></p>
      </section>
    </main>
  )
}
