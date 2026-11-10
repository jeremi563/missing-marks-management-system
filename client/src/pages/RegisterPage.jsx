import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle,
  GraduationCap,
  LockKeyhole,
  Mail,
  UserRound,
} from 'lucide-react'

import { registerUser } from '../api/auth'
import { getApiErrorMessage } from '../api/errorHandler'
import { buildRegistrationPayload } from '../features/auth/registration'
import '../styles/LoginPage.css'
import '../styles/RegisterPage.css'

function RegisterPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    const registration = buildRegistrationPayload({
      displayName,
      email,
      password,
      registrationNumber,
    })

    try {
      setIsSubmitting(true)
      const response = await registerUser(registration)
      const registrationStatus = response?.data?.status

      setSuccess(
        registrationStatus === 'PENDING_EMAIL_AND_ADMIN_APPROVAL'
          ? 'Your registration number was identified as a staff account. Verify your email; your account will be available after administrator approval.'
          : 'Your registration number was verified as a student account. Check your email to verify your account before signing in.'
      )
    } catch (registrationError) {
      setError(getApiErrorMessage(registrationError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card register-card">
        <div className="login-brand">
          <div className="login-brand-icon">
            <GraduationCap size={26} />
          </div>
          <h1>Missing Marks</h1>
          <p>Management System</p>
        </div>

        <div className="login-heading">
          <h2>Create your account</h2>
          <p>Your university registration number determines your account type.</p>
        </div>

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        {success ? (
          <div className="register-success" role="status">
            <CheckCircle size={25} />
            <p>{success}</p>
            <Link to="/login" className="login-submit register-success-link">
              Continue to sign in <ArrowRight size={17} />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="display-name">Full name</label>
              <div className="login-input-wrapper">
                <UserRound size={19} />
                <input
                  id="display-name"
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  maxLength={200}
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="register-email">University email</label>
              <div className="login-input-wrapper">
                <Mail size={19} />
                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@university.edu"
                  autoComplete="email"
                  maxLength={254}
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="registration-number">University registration number</label>
              <div className="login-input-wrapper">
                <GraduationCap size={19} />
                <input
                  id="registration-number"
                  type="text"
                  value={registrationNumber}
                  onChange={(event) => setRegistrationNumber(event.target.value)}
                  placeholder="Your student or staff number"
                  autoComplete="off"
                  maxLength={100}
                  required
                />
              </div>
              <small className="register-hint">
                Student records are verified against the university roster. Staff accounts require administrator approval.
              </small>
            </div>

            <div className="login-field">
              <label htmlFor="register-password">Password</label>
              <div className="login-input-wrapper">
                <LockKeyhole size={19} />
                <input
                  id="register-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 12 characters"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </div>
              <small className="register-hint">Use 12 to 128 characters.</small>
            </div>

            <div className="login-field">
              <label htmlFor="confirm-password">Confirm password</label>
              <div className="login-input-wrapper">
                <LockKeyhole size={19} />
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Enter your password again"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="login-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}
              {!isSubmitting && <ArrowRight size={18} />}
            </button>
          </form>
        )}

        {!success && (
          <p className="login-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        )}

        <p className="login-footer">Missing Marks Management System</p>
      </section>
    </main>
  )
}

export default RegisterPage
