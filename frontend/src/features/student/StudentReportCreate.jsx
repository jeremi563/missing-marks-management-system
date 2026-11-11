import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Send } from 'lucide-react'
import { createStudentReport } from '../../api/student'

export default function StudentReportCreate() {
  const [form, setForm] = useState({ courseUnitId: '', academicPeriodId: '', assessmentId: '', assessmentComponent: '', description: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    const payload = {
      courseUnitId: form.courseUnitId.trim(),
      academicPeriodId: form.academicPeriodId.trim(),
      ...(form.assessmentId.trim() ? { assessmentId: form.assessmentId.trim() } : {}),
      assessmentComponent: form.assessmentComponent.trim(),
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
        <div><p className="eyebrow">STUDENT PORTAL</p><h2>Submit a missing-mark report</h2><p>Provide the course and assessment information so the department can investigate.</p></div>
        <Link className="button button-secondary" to="/student/reports"><ArrowLeft size={16} /> My reports</Link>
      </header>
      <form className="panel" onSubmit={submit}>
        {error && <div className="form-alert" role="alert">{error}</div>}
        <div className="form-grid">
          <div className="form-field"><label htmlFor="course-unit-id">Course unit ID</label><input id="course-unit-id" name="courseUnitId" value={form.courseUnitId} onChange={update} placeholder="Course unit UUID" required /></div>
          <div className="form-field"><label htmlFor="academic-period-id">Academic period ID</label><input id="academic-period-id" name="academicPeriodId" value={form.academicPeriodId} onChange={update} placeholder="Academic period UUID" required /></div>
          <div className="form-field"><label htmlFor="assessment-id">Assessment ID <span className="field-hint">(optional)</span></label><input id="assessment-id" name="assessmentId" value={form.assessmentId} onChange={update} placeholder="Assessment UUID" /></div>
          <div className="form-field"><label htmlFor="assessment-component">Assessment component</label><input id="assessment-component" name="assessmentComponent" value={form.assessmentComponent} onChange={update} maxLength={100} placeholder="e.g. Mid-semester test" required /></div>
          <div className="form-field full"><label htmlFor="report-description">Explain the issue</label><textarea id="report-description" name="description" value={form.description} onChange={update} maxLength={5000} rows={5} required placeholder="Include relevant dates and any information that may help verify your mark." /></div>
        </div>
        <p className="field-hint">Course, period, and assessment identifiers are UUIDs provided by your department.</p>
        <button className="button button-primary" disabled={submitting}><Send size={16} />{submitting ? 'Submitting…' : 'Submit report'}</button>
      </form>
    </section>
  )
}
