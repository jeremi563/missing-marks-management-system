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
  const [role, setRole] = useState('student')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [identityNumber, setIdentityNumber] = useState('')
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
      role,
      displayName,
      email,
      password,
      identityNumber,
    })

    try {
      setIsSubmitting(true)
      const response = await registerUser(registration)
      const registrationStatus = response?.data?.status

      setSuccess(registrationStatus === 'PENDING_EMAIL_AND_ADMIN_APPROVAL'
        ? 'Check your email to verify your address. An administrator must approve your staff account before you can sign in.'
        : 'Your student details matched the university roster. Check your email to verify your address before signing in.')
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
          <p>Register as a student, lecturer, or COD.</p>
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
              <label htmlFor="account-role">Account type</label>
              <select
                id="account-role"
                value={role}
                onChange={(event) => {
                  setRole(event.target.value)
                  setIdentityNumber('')
                }}
                required
              >
                <option value="student">Student</option>
                <option value="lecturer">Lecturer</option>
                <option value="cod">COD</option>
              </select>
            </div>

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
              <label htmlFor="identity-number">
                {role === 'student' ? 'Student registration number' : 'Staff number'}
              </label>
              <div className="login-input-wrapper">
                <GraduationCap size={19} />
                <input
                  id="identity-number"
                  type="text"
                  value={identityNumber}
                  onChange={(event) => setIdentityNumber(event.target.value)}
                  placeholder={role === 'student' ? 'Your student number' : 'Your staff number'}
                  autoComplete="off"
                  maxLength={100}
                  required
                />
              </div>
              <small className="register-hint">
                {role === 'student'
                  ? 'Your student number and email must match the university roster.'
                  : 'Verify your email; administrator approval is required before staff access is enabled.'}
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
