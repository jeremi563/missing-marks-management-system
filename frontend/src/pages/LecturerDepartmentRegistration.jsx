import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, GraduationCap } from 'lucide-react'
import { getRegistrationDepartments, registerLecturerDepartment } from '../api/auth'
import { extractRecords } from '../features/shared/recordUtils'
import { useAuth } from '../auth/useAuth'

const initialForm = {
  displayName: '',
  email: '',
  registrationNumber: '',
  password: '',
  departmentId: '',
}

export default function LecturerDepartmentRegistration() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [departments, setDepartments] = useState([])
  const [loadingDepartments, setLoadingDepartments] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState('')

  if (isLoading) return null
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!user?.roles?.includes('lecturer')) return <Navigate to="/403" replace />
  if (user?.approvalStatus === 'APPROVED') return <Navigate to="/lecturer" replace />

  useEffect(() => {
    let active = true
    getRegistrationDepartments().then((response) => {
      if (active) setDepartments(extractRecords(response, ['departments']))
    }).catch((requestError) => {
      if (active) setError(requestError.userMessage || 'Unable to load departments.')
    }).finally(() => {
      if (active) setLoadingDepartments(false)
    })
    return () => { active = false }
  }, [])

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await registerLecturerDepartment({
        ...form,
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        registrationNumber: form.registrationNumber.trim(),
      })
      setComplete(true)
    } catch (requestError) {
      const validationDetails = requestError.response?.data?.details
      const validationMessage = Array.isArray(validationDetails)
        ? validationDetails.map(({ message }) => message).filter(Boolean).join(' ')
        : ''
      setError(validationMessage || requestError.userMessage || 'Unable to complete lecturer registration.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <Link to="/register" className="back-link"><ArrowLeft size={16} /> Back to registration</Link>
      <section className="auth-card auth-card-wide">
        <Link to="/" className="public-brand"><span className="brand-icon"><GraduationCap size={21} /></span>Missing Marks</Link>
        {complete ? (
          <>
            <p className="eyebrow">APPLICATION SUBMITTED</p>
            <h1>Awaiting department COD approval</h1>
            <p className="auth-intro">Your lecturer details have been matched to the account you created. Your selected department's COD will review the application before you can sign in.</p>
            <Link className="button button-primary button-full" to="/login">Go to sign in</Link>
          </>
        ) : (
          <>
            <p className="eyebrow">LECTURER REGISTRATION · STEP 2</p>
            <h1>Choose your department</h1>
            <p className="auth-intro">Re-enter the details from your first registration and select your department. The department's designated COD will review your application.</p>
            {error && <div className="form-alert" role="alert">{error}</div>}
            <form onSubmit={submit}>
              <label htmlFor="lecturer-register-name">Full name</label>
              <input id="lecturer-register-name" name="displayName" value={form.displayName} onChange={update} autoComplete="name" required maxLength={200} />
              <label htmlFor="lecturer-register-email">Institutional email</label>
              <input id="lecturer-register-email" name="email" type="email" value={form.email} onChange={update} autoComplete="email" required />
              <label htmlFor="lecturer-register-number">Staff number</label>
              <input id="lecturer-register-number" name="registrationNumber" value={form.registrationNumber} onChange={update} autoComplete="off" required maxLength={100} />
              <label htmlFor="lecturer-register-password">Password from your first registration</label>
              <div className="auth-password-field">
                <input id="lecturer-register-password" name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={update} autoComplete="new-password" minLength={8} required />
                <button className="auth-password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <label htmlFor="lecturer-register-department">Department</label>
              <select id="lecturer-register-department" name="departmentId" value={form.departmentId} onChange={update} required disabled={loadingDepartments || departments.length === 0}>
                <option value="">{loadingDepartments ? 'Loading departments…' : 'Select your department'}</option>
                {departments.map((department) => <option value={department.id} key={department.id}>{department.name}{department.code ? ` (${department.code})` : ''}</option>)}
              </select>
              {!loadingDepartments && departments.length === 0 && <small className="field-hint">No departments are configured yet. Contact an administrator before completing registration.</small>}
              <button className="button button-primary button-full" type="submit" disabled={submitting || loadingDepartments || departments.length === 0}>{submitting ? 'Submitting…' : 'Submit for COD approval'}</button>
            </form>
            <p className="auth-switch">Already completed this form? <Link to="/login">Sign in</Link></p>
          </>
        )}
      </section>
    </main>
  )
}
