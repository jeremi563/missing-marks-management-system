import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle, Clock, FileText, Send } from 'lucide-react'
import StatusChip from '../../components/ui/StatusChip'
import LoadingState from '../../components/ui/LoadingState'
import ErrorState from '../../components/ui/ErrorState'
import EvidenceList from '../shared/EvidenceList'
import { fetchAllRecordPages } from '../shared/recordUtils'
import { validateEvidenceSelection } from '../shared/evidenceFiles'
import {
  acknowledgeStudentSpecialCaseSchedule,
  getStudentSpecialCase,
  getStudentSpecialCaseOptions,
  getStudentSpecialCases,
  submitStandaloneStudentSpecialCase,
} from '../../api/student'
import './StudentSpecialCases.css'

function unwrap(response) {
  const first = response?.data ?? response
  return first?.data ?? first
}

function formatDate(value, includeTime = false) {
  if (!value) return 'Not available'
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? 'Not available' : date.toLocaleString(undefined, includeTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' })
}

function currentSchedule(schedules = []) {
  return [...schedules].reverse().find(({ status }) => status === 'SCHEDULED')
}

function latestLecturerRecommendation(reviews = []) {
  return [...reviews].reverse().find(({ reviewerRole, action }) =>
    reviewerRole === 'LECTURER' && action === 'RECOMMENDATION'
  )
}

export default function StudentSpecialCases() {
  const [options, setOptions] = useState({ categories: [], enrollments: [] })
  const [cases, setCases] = useState([])
  const [periodId, setPeriodId] = useState('')
  const [courseUnitId, setCourseUnitId] = useState('')
  const [assessmentId, setAssessmentId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState([])
  const [evidenceError, setEvidenceError] = useState('')
  const [selectedCase, setSelectedCase] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(async () => {
    const [optionResponse, caseResponse] = await Promise.all([
      getStudentSpecialCaseOptions(),
      getStudentSpecialCases({ page: 1, limit: 100 }),
    ])
    return {
      options: unwrap(optionResponse),
      cases: await fetchAllRecordPages(
        (page) => getStudentSpecialCases({ page, limit: 100 }),
        caseResponse,
        ['items', 'cases', 'specialCases'],
      ),
    }
  }, [])

  const refresh = async (caseId) => {
    const data = await load()
    setOptions({ categories: data.options?.categories ?? [], enrollments: data.options?.enrollments ?? [] })
    setCases(data.cases)
    if (caseId) {
      const detail = await getStudentSpecialCase(caseId)
      setSelectedCase(unwrap(detail))
    }
  }

  useEffect(() => {
    let active = true
    load().then((data) => {
      if (!active) return
      setOptions({ categories: data.options?.categories ?? [], enrollments: data.options?.enrollments ?? [] })
      setCases(data.cases)
      setError('')
    }).catch((requestError) => {
      if (active) setError(requestError.userMessage || 'Unable to load your special cases.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [load])

  const periods = useMemo(() => {
    const byId = new Map()
    options.enrollments.forEach(({ academicPeriod }) => {
      if (academicPeriod && !byId.has(academicPeriod.id)) byId.set(academicPeriod.id, academicPeriod)
    })
    return [...byId.values()]
  }, [options.enrollments])
  const availableUnits = options.enrollments.filter(({ academicPeriod }) => academicPeriod?.id === periodId)
  const enrollment = availableUnits.find(({ courseUnit }) => courseUnit?.id === courseUnitId)
  const assessments = enrollment?.assessments ?? []

  const choosePeriod = (value) => {
    setPeriodId(value)
    setCourseUnitId('')
    setAssessmentId('')
  }

  const chooseUnit = (value) => {
    setCourseUnitId(value)
    setAssessmentId('')
  }

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

  const submit = async (event) => {
    event.preventDefault()
    if (!evidenceFiles.length) {
      setEvidenceError('At least one supporting document is required.')
      return
    }
    setSubmitting(true)
    setError('')
    setSuccess('')
    try {
      await submitStandaloneStudentSpecialCase({
        academicPeriodId: periodId,
        courseUnitId,
        assessmentId,
        categoryId,
        description: description.trim(),
      }, evidenceFiles)
      setPeriodId('')
      setCourseUnitId('')
      setAssessmentId('')
      setCategoryId('')
      setDescription('')
      setEvidenceFiles([])
      setEvidenceError('')
      setSuccess('Your special-case application was submitted.')
      await refresh()
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to submit your application.')
    } finally {
      setSubmitting(false)
    }
  }

  const openCase = async (item) => {
    setError('')
    try {
      setSelectedCase(unwrap(await getStudentSpecialCase(item.id)))
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to load application details.')
    }
  }

  const acknowledge = async () => {
    if (!selectedCase) return
    setError('')
    try {
      await acknowledgeStudentSpecialCaseSchedule(selectedCase.id)
      await refresh(selectedCase.id)
      setSuccess('The current assessment schedule has been acknowledged.')
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to acknowledge this schedule.')
    }
  }

  if (loading) return <LoadingState message="Loading your special cases…" />
  if (error && !cases.length && !options.enrollments.length) {
    return <ErrorState title="Special cases unavailable" message={error} onRetry={() => { setLoading(true); load().then((data) => { setOptions(data.options); setCases(data.cases); setError('') }).catch((requestError) => setError(requestError.userMessage || 'Unable to load special cases.')).finally(() => setLoading(false)) }} />
  }

  const selectedRecommendation = selectedCase ? latestLecturerRecommendation(selectedCase.reviews) : null
  const codDecision = selectedCase?.reviews?.slice().reverse().find(({ reviewerRole, action }) => reviewerRole === 'COD' && action === 'FINAL_DECISION')
  const schedule = selectedCase ? currentSchedule(selectedCase.schedules) : null

  return (
    <section className="student-special-cases">
      <header className="page-heading">
        <div>
          <p className="eyebrow">STUDENT PORTAL</p>
          <h2>Special cases</h2>
          <p>Apply for consideration after missing an assessment. This process is separate from missing-mark reports and appeals.</p>
        </div>
      </header>
      {error && <div className="form-alert" role="alert">{error}</div>}
      {success && <div className="form-alert success" role="status">{success}</div>}

      <form className="panel special-case-form" onSubmit={submit}>
        <h3>New application</h3>
        <p>Choose the assessment you missed, explain the circumstances, and attach at least one supporting document.</p>
        <div className="special-case-form-grid">
          <label>
            Academic period
            <select value={periodId} onChange={(event) => choosePeriod(event.target.value)} required>
              <option value="">Select an academic period</option>
              {periods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}
            </select>
          </label>
          <label>
            Course unit
            <select value={courseUnitId} onChange={(event) => chooseUnit(event.target.value)} required disabled={!periodId}>
              <option value="">Select a course unit</option>
              {availableUnits.map(({ courseUnit }) => <option key={courseUnit.id} value={courseUnit.id}>{courseUnit.code} · {courseUnit.name}</option>)}
            </select>
          </label>
          <label>
            Assessment missed
            <select value={assessmentId} onChange={(event) => setAssessmentId(event.target.value)} required disabled={!courseUnitId}>
              <option value="">{assessments.length ? 'Select an assessment' : 'No eligible past assessments'}</option>
              {assessments.map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.name} · {formatDate(assessment.assessmentDate)}</option>)}
            </select>
          </label>
          <label>
            Special-case category
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
              <option value="">{options.categories.length ? 'Select a category' : 'No categories are configured'}</option>
              {options.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
        </div>
        {(!options.categories.length || !options.enrollments.length) && (
          <p className="special-case-note" role="status">
            {!options.enrollments.length ? 'No course registrations are available for an eligible past assessment.' : 'Special-case categories have not been configured by your department yet.'}
          </p>
        )}
        <label htmlFor="special-case-explanation">Detailed explanation</label>
        <textarea id="special-case-explanation" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} required rows={5} />
        <label htmlFor="special-case-evidence">Supporting evidence <span className="required-label">(required)</span></label>
        <input id="special-case-evidence" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.docx" onChange={selectEvidence} aria-describedby="special-case-evidence-help" />
        <small id="special-case-evidence-help">PDF, JPG, PNG or DOCX; up to 3 files, 5 MB each.</small>
        {evidenceError && <p className="form-alert" role="alert">{evidenceError}</p>}
        {evidenceFiles.length > 0 && <ul className="special-case-selected-files">{evidenceFiles.map((file, index) => <li key={`${file.name}-${index}`}>{file.name}<button type="button" className="button button-secondary" onClick={() => setEvidenceFiles((items) => items.filter((_, fileIndex) => fileIndex !== index))}>Remove</button></li>)}</ul>}
        <button className="button button-primary" disabled={submitting || !options.categories.length || !options.enrollments.length}>
          <Send size={16} />{submitting ? 'Submitting…' : 'Submit application'}
        </button>
      </form>

      <section className="special-case-applications" aria-labelledby="student-special-case-list">
        <h3 id="student-special-case-list">Your applications</h3>
        {!cases.length ? (
          <div className="special-case-empty"><FileText size={28} /><p>You have not submitted a special-case application.</p></div>
        ) : (
          <div className="special-case-card-list">
            {cases.map((item) => {
              const latestSchedule = currentSchedule(item.schedules)
              return (
                <article className="special-case-card" key={item.id}>
                  <div className="special-case-card-heading">
                    <div><h4>Application {item.id}</h4><p>{item.courseUnit?.code} · {item.courseUnit?.name}</p></div>
                    <StatusChip status={item.status} />
                  </div>
                  <p>{item.assessment?.name || 'Assessment'} · {item.categoryRecord?.name || item.category}</p>
                  <small>Submitted {formatDate(item.submittedAt || item.createdAt)}</small>
                  {latestSchedule && <p><Clock size={15} /> Scheduled {formatDate(latestSchedule.startsAt, true)} at {latestSchedule.venue}</p>}
                  <button type="button" className="button button-secondary" onClick={() => openCase(item)}>View application details</button>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {selectedCase && (
        <section className="panel special-case-details" aria-labelledby="special-case-detail-heading">
          <header className="page-heading">
            <div><p className="eyebrow">APPLICATION DETAILS</p><h3 id="special-case-detail-heading">{selectedCase.id}</h3></div>
            <div className="record-actions"><StatusChip status={selectedCase.status} /><button type="button" className="button button-secondary" onClick={() => setSelectedCase(null)}>Close details</button></div>
          </header>
          <dl className="special-case-detail-grid">
            <div><dt>Course unit</dt><dd>{selectedCase.courseUnit?.code} · {selectedCase.courseUnit?.name}</dd></div>
            <div><dt>Academic period</dt><dd>{selectedCase.academicPeriod?.name}</dd></div>
            <div><dt>Assessment</dt><dd>{selectedCase.assessment?.name} · {formatDate(selectedCase.assessment?.assessmentDate)}</dd></div>
            <div><dt>Category</dt><dd>{selectedCase.categoryRecord?.name || selectedCase.category}</dd></div>
            <div><dt>Submitted</dt><dd>{formatDate(selectedCase.submittedAt || selectedCase.createdAt, true)}</dd></div>
            <div><dt>COD decision</dt><dd>{selectedCase.decisionAt ? `${selectedCase.status} · ${formatDate(selectedCase.decisionAt, true)}` : 'Pending'}</dd></div>
          </dl>
          <section className="details-card"><h4>Your explanation</h4><p>{selectedCase.description}</p></section>
          <EvidenceList evidence={selectedCase.evidence} title="Supporting evidence" />
          <section className="details-card">
            <h4>Lecturer recommendation</h4>
            {selectedRecommendation
              ? <><p><strong>{selectedRecommendation.decision === 'RECOMMEND_APPROVAL' ? 'Recommends approval' : 'Recommends rejection'}</strong></p><p>{selectedRecommendation.comments}</p></>
              : <p>Pending lecturer review.</p>}
          </section>
          <section className="details-card">
            <h4>COD decision and feedback</h4>
            {codDecision
              ? <><p>{codDecision.decision === 'APPROVE' ? 'Approved' : codDecision.decision === 'REJECT' ? 'Rejected' : codDecision.decision}</p><p>{codDecision.comments || selectedCase.decisionReason}</p></>
              : <p>Pending final departmental decision.</p>}
          </section>
          <section className="details-card">
            <h4>Assessment schedule history</h4>
            {selectedCase.schedules?.length
              ? selectedCase.schedules.map((item) => <article key={item.id} className="special-case-history-item">
                <p><strong>Schedule {item.version}</strong> · {item.status}</p>
                <p>{formatDate(item.startsAt, true)} – {formatDate(item.endsAt, true)} · {item.venue}</p>
                <p>{item.acknowledgedAt ? `Acknowledged ${formatDate(item.acknowledgedAt, true)}` : item.status === 'SCHEDULED' ? 'Awaiting your acknowledgement' : 'Not acknowledged'}</p>
                {item.changeReason && <p>Rescheduling reason: {item.changeReason}</p>}
              </article>)
              : <p>No assessment has been scheduled yet.</p>}
            {schedule && !schedule.acknowledgedAt && <button className="button button-primary" type="button" onClick={acknowledge}><CheckCircle size={16} /> Acknowledge schedule</button>}
          </section>
          <section className="details-card"><h4>Attendance and completion</h4>{selectedCase.attendances?.length ? selectedCase.attendances.map((item) => <p key={item.id}>{item.outcome === 'ATTENDED' ? 'Attended' : 'Did not attend'} · {formatDate(item.recordedAt, true)}{item.remarks ? ` · ${item.remarks}` : ''}</p>) : <p>Attendance has not been recorded. Schedule acknowledgement is not attendance.</p>}</section>
        </section>
      )}
    </section>
  )
}
