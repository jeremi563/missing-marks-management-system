import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, CircleCheck, CircleHelp, CircleX, Send } from 'lucide-react'
import { createStudentReport, getStudentReportOptions } from '../../api/student'
import { formatEvidenceSize, validateEvidenceSelection } from '../shared/evidenceFiles'
import './StudentReportCreate.css'

const attendanceCheckLabels = {
  'attendance.classAttendance': 'Class attendance',
  'attendance.catAttendance': 'CAT attendance',
  'attendance.examAttendance': 'Exam attendance',
}

function getAttendanceCheckState(message) {
  const normalized = message.toLowerCase()
  if (normalized.includes(': not met;')) return 'not-met'
  if (normalized.includes(': met;')) return 'met'
  return 'unknown'
}

function getAttendanceCheckDescription(message) {
  return message
    .replace(/^[^:]+:\s*/, '')
    .replace(/^(met|not met|not confirmed);\s*/i, '')
}

export default function StudentReportCreate() {
  const [form, setForm] = useState({ courseUnitId: '', academicYear: '', description: '' })
  const [courseUnits, setCourseUnits] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [optionsError, setOptionsError] = useState('')
  const [optionsRetry, setOptionsRetry] = useState(0)
  const [error, setError] = useState('')
  const [attendanceChecks, setAttendanceChecks] = useState([])
  const [evidenceFiles, setEvidenceFiles] = useState([])
  const [evidenceError, setEvidenceError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    getStudentReportOptions()
      .then((response) => {
        if (!Array.isArray(response.data)) throw new Error('The server returned invalid course unit options.')
        if (active) setCourseUnits(response.data)
      })
      .catch((requestError) => {
        if (active) setOptionsError(requestError.userMessage || requestError.message || 'Unable to load your course units.')
      })
      .finally(() => {
        if (active) setLoadingOptions(false)
      })

    return () => { active = false }
  }, [optionsRetry])

  const retryLoadingOptions = () => {
    setLoadingOptions(true)
    setOptionsError('')
    setOptionsRetry((retry) => retry + 1)
  }
  const selectedCourseUnit = courseUnits.find(({ id }) => id === form.courseUnitId)
  const metAttendanceChecks = attendanceChecks.filter(({ message }) => getAttendanceCheckState(message) === 'met').length
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  const selectEvidence = (event) => {
    const nextFiles = [...evidenceFiles, ...Array.from(event.currentTarget.files || [])]
    const validationError = validateEvidenceSelection(nextFiles)
    if (validationError) setEvidenceError(validationError)
    else {
      setEvidenceFiles(nextFiles)
      setEvidenceError('')
    }
    event.currentTarget.value = ''
  }
  const removeEvidence = (index) => {
    setEvidenceFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))
    setEvidenceError('')
  }
  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setAttendanceChecks([])
    setSubmitting(true)
    const payload = {
      courseUnitId: form.courseUnitId.trim(),
      academicYear: form.academicYear,
      description: form.description.trim(),
    }
    try {
      await createStudentReport(payload, evidenceFiles)
      navigate('/student/reports', { replace: true })
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to submit your report.')
      const details = requestError.response?.data?.details
      setAttendanceChecks(Array.isArray(details)
        ? details.filter(({ path, message }) => path?.startsWith('attendance.') && message)
        : [])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="student-report-create-page">
      <header className="page-heading">
        <div><p className="eyebrow">STUDENT PORTAL</p><h2>Submit a missing-mark report</h2><p>Select a course unit from your registration-number course and explain the missing mark.</p></div>
        <Link className="button button-secondary" to="/student/reports"><ArrowLeft size={16} /> My reports</Link>
      </header>
      <form className="panel" onSubmit={submit}>
        {error && (
          <section className="report-submit-error" role="alert" aria-labelledby="report-submit-error-title">
            <header className="report-submit-error__header">
              <span className="report-submit-error__icon" aria-hidden="true"><AlertTriangle size={21} /></span>
              <div>
                <p className="report-submit-error__eyebrow">Submission blocked</p>
                <h3 id="report-submit-error-title">Your report wasn’t submitted</h3>
                <p className="report-submit-error__message">{error}</p>
              </div>
            </header>
            {attendanceChecks.length > 0 && (
              <>
                <div className="report-submit-error__summary">
                  <h4>Attendance eligibility</h4>
                  <span>{metAttendanceChecks} of {attendanceChecks.length} checks met</span>
                </div>
                <ul className="report-submit-error__checks">
                  {attendanceChecks.map(({ path, message }) => {
                    const state = getAttendanceCheckState(message)
                    const CheckIcon = state === 'met' ? CircleCheck : state === 'not-met' ? CircleX : CircleHelp
                    const stateLabel = state === 'met' ? 'Met' : state === 'not-met' ? 'Not met' : 'Not confirmed'
                    return (
                      <li className={`report-submit-error__check report-submit-error__check--${state}`} key={path}>
                        <CheckIcon className="report-submit-error__check-icon" size={20} aria-hidden="true" />
                        <div className="report-submit-error__check-copy">
                          <h5>{attendanceCheckLabels[path] || 'Attendance requirement'}</h5>
                          <p>{getAttendanceCheckDescription(message)}</p>
                        </div>
                        <span className="report-submit-error__state">{stateLabel}</span>
                      </li>
                    )
                  })}
                </ul>
                <p className="report-submit-error__footnote">Meet the outstanding requirements, then try submitting again. No report was created.</p>
              </>
            )}
          </section>
        )}
        {optionsError && <div className="form-alert" role="alert">{optionsError} <button className="link-button" type="button" onClick={retryLoadingOptions}>Try again</button></div>}
        <div className="form-grid">
          <div className="form-field"><label htmlFor="course-unit-id">Course unit</label><select id="course-unit-id" name="courseUnitId" value={form.courseUnitId} onChange={(event) => setForm((current) => ({ ...current, courseUnitId: event.target.value, academicPeriodId: '' }))} required disabled={loadingOptions || courseUnits.length === 0}><option value="">{loadingOptions ? 'Loading course units…' : courseUnits.length ? 'Select a course unit' : 'No enrolled course units found'}</option>{courseUnits.map((courseUnit) => <option key={courseUnit.id} value={courseUnit.id}>{courseUnit.code} — {courseUnit.name}</option>)}</select></div>
          <div className="form-field"><label htmlFor="academic-year">Academic year</label><select id="academic-year" name="academicYear" value={form.academicYear} onChange={update} required disabled={!selectedCourseUnit}><option value="">{selectedCourseUnit ? 'Select an academic year' : 'Select a course unit first'}</option>{selectedCourseUnit?.academicYears.map((year) => <option key={year.value} value={year.value} disabled={!year.academicPeriodId}>{year.label}</option>)}</select></div>
          <div className="form-field full"><label htmlFor="report-description">Explain the issue</label><textarea id="report-description" name="description" value={form.description} onChange={update} maxLength={5000} rows={5} required placeholder="Include relevant dates and any information that may help verify your mark." /></div>
          <div className="form-field full">
            <label htmlFor="report-evidence">Evidence files (optional)</label>
            <input id="report-evidence" type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple onChange={selectEvidence} />
            <small>PDF, JPG, JPEG, PNG or DOCX; up to 3 files, 5 MB each.</small>
            {evidenceError && <p className="form-error" role="alert">{evidenceError}</p>}
            {evidenceFiles.length > 0 && <ul className="evidence-list">{evidenceFiles.map((file, index) => (
              <li key={`${file.name}-${index}`}><span>{file.name} · {formatEvidenceSize(file.size)}</span><button className="button button-secondary" type="button" onClick={() => removeEvidence(index)}>Remove</button></li>
            ))}</ul>}
          </div>
        </div>
        <button className="button button-primary" disabled={submitting || loadingOptions || Boolean(optionsError) || Boolean(evidenceError) || !courseUnits.length}><Send size={16} />{submitting ? 'Submitting…' : 'Submit report'}</button>
      </form>
    </section>
  )
}
