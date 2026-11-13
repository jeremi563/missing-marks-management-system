import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send } from 'lucide-react'
import { createStudentReport, getStudentReportOptions } from '../../api/student'

export default function StudentReportCreate() {
  const [form, setForm] = useState({ courseUnitId: '', academicYear: '', description: '' })
  const [courseUnits, setCourseUnits] = useState([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [optionsError, setOptionsError] = useState('')
  const [optionsRetry, setOptionsRetry] = useState(0)
  const [error, setError] = useState('')
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
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    const payload = {
      courseUnitId: form.courseUnitId.trim(),
      academicYear: form.academicYear,
      description: form.description.trim(),
    }
    try {
      await createStudentReport(payload)
      navigate('/student/reports', { replace: true })
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to submit your report.')
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
        {error && <div className="form-alert" role="alert">{error}</div>}
        {optionsError && <div className="form-alert" role="alert">{optionsError} <button className="link-button" type="button" onClick={retryLoadingOptions}>Try again</button></div>}
        <div className="form-grid">
          <div className="form-field"><label htmlFor="course-unit-id">Course unit</label><select id="course-unit-id" name="courseUnitId" value={form.courseUnitId} onChange={(event) => setForm((current) => ({ ...current, courseUnitId: event.target.value, academicPeriodId: '' }))} required disabled={loadingOptions || courseUnits.length === 0}><option value="">{loadingOptions ? 'Loading course units…' : courseUnits.length ? 'Select a course unit' : 'No enrolled course units found'}</option>{courseUnits.map((courseUnit) => <option key={courseUnit.id} value={courseUnit.id}>{courseUnit.code} — {courseUnit.name}</option>)}</select></div>
          <div className="form-field"><label htmlFor="academic-year">Academic year</label><select id="academic-year" name="academicYear" value={form.academicYear} onChange={update} required disabled={!selectedCourseUnit}><option value="">{selectedCourseUnit ? 'Select an academic year' : 'Select a course unit first'}</option>{selectedCourseUnit?.academicYears.map((year) => <option key={year.value} value={year.value} disabled={!year.academicPeriodId}>{year.label}</option>)}</select></div>
          <div className="form-field full"><label htmlFor="report-description">Explain the issue</label><textarea id="report-description" name="description" value={form.description} onChange={update} maxLength={5000} rows={5} required placeholder="Include relevant dates and any information that may help verify your mark." /></div>
        </div>
        <button className="button button-primary" disabled={submitting || loadingOptions || Boolean(optionsError) || !courseUnits.length}><Send size={16} />{submitting ? 'Submitting…' : 'Submit report'}</button>
      </form>
    </section>
  )
}
