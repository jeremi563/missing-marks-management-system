import { useCallback, useEffect, useState } from 'react'
import {
  addLecturerReportComment,
  decideLecturerReport,
  escalateLecturerReport,
  getLecturerAssessmentTypes,
  getLecturerReport,
  getLecturerReportComments,
  submitLecturerCorrection,
} from '../../api/lecturer'
import { extractRecords } from '../shared/recordUtils'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import StatusChip from '../../components/ui/StatusChip'

function unwrap(response) {
  const first = response?.data ?? response
  return first?.data ?? first
}

function AttendanceCheck({ label, check }) {
  const statusLabels = { present: 'Present', absent: 'Not present', unknown: 'Unknown' }
  return (
    <article className={`report-attendance-check report-attendance-check-${check.status}`}>
      <div><strong>{label}</strong><span>{statusLabels[check.status] || statusLabels.unknown}</span></div>
      {check.items.length > 0
        ? check.items.map((item) => <small key={item.assessmentId}>{item.code || item.name}: {statusLabels[item.status] || statusLabels.unknown}</small>)
        : <small>No matching assessment attendance data is available.</small>}
    </article>
  )
}

export default function ReportReviewPanel({ reportId, onClose }) {
  const [report, setReport] = useState(null)
  const [comments, setComments] = useState([])
  const [assessmentTypes, setAssessmentTypes] = useState([])
  const [assessmentTypeId, setAssessmentTypeId] = useState('')
  const [assessmentTypeOtherDescription, setAssessmentTypeOtherDescription] = useState('')
  const [comment, setComment] = useState('')
  const [reason, setReason] = useState('')
  const [escalation, setEscalation] = useState('')
  const [correctionValue, setCorrectionValue] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [reportResponse, commentsResponse, typesResponse] = await Promise.all([
      getLecturerReport(reportId),
      getLecturerReportComments(reportId),
      getLecturerAssessmentTypes(),
    ])
    return {
      report: unwrap(reportResponse),
      comments: extractRecords(commentsResponse, ['comments']),
      assessmentTypes: extractRecords(typesResponse, ['assessmentTypes', 'types']),
    }
  }, [reportId])

  useEffect(() => {
    let active = true
    load().then((data) => {
      if (!active) return
      setReport(data.report)
      setComments(data.comments)
      setAssessmentTypes(data.assessmentTypes)
      setError('')
    }).catch((requestError) => { if (active) setError(requestError.userMessage || 'Unable to load report details.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [load])

  const act = async (operation) => {
    setBusy(true)
    setError('')
    try {
      await operation()
      const data = await load()
      setReport(data.report)
      setComments(data.comments)
      setAssessmentTypes(data.assessmentTypes)
      setError('')
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to complete this report action.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingState message="Loading report…" />
  if (error && !report) return <ErrorState title="Report unavailable" message={error} onRetry={() => { setLoading(true); load().catch((e) => setError(e.userMessage || 'Unable to load report.')).finally(() => setLoading(false)) }} />
  if (!report) return null

  const selectedAssessmentType = assessmentTypes.find(({ id }) => id === assessmentTypeId)
  const isOtherAssessmentType = selectedAssessmentType?.code === 'OTHER'
  const canSubmitDecision = Boolean(assessmentTypeId)
    && (!isOtherAssessmentType || Boolean(assessmentTypeOtherDescription.trim()))
  const decisionPayload = (decision) => ({
    decision,
    reason: reason.trim(),
    assessmentTypeId,
    ...(isOtherAssessmentType ? { assessmentTypeOtherDescription: assessmentTypeOtherDescription.trim() } : {}),
  })

  return (
    <section className="panel" style={{ marginTop: 22 }}>
      <header className="page-heading"><div><p className="eyebrow">REPORT REVIEW</p><h2>{report.reference || report.reportNumber || `Report ${report.id}`}</h2><p>{report.courseUnit?.name || report.courseUnit?.code || 'Course unit'} · {report.student?.displayName || report.student?.name || report.student?.studentNumber || 'Student'}</p></div><div className="record-actions"><StatusChip status={report.status} /><button className="button button-secondary" onClick={onClose}>Close</button></div></header>
      {error && <div className="form-alert" role="alert">{error}</div>}
      <p>{report.description || report.reason || 'No description provided.'}</p>
      {report.attendanceReview && (
        <section className="details-card report-attendance-review" aria-labelledby="report-attendance-review-heading">
          <div className="report-attendance-review-heading">
            <div>
              <h3 id="report-attendance-review-heading">Attendance review</h3>
              <p>Automatic record check for {report.courseUnit?.code || 'this course unit'} · {report.attendanceReview.academicYear || 'academic year unavailable'}</p>
            </div>
          </div>
          <div className="report-attendance-check-grid">
            <AttendanceCheck label="CAT attendance" check={report.attendanceReview.assessments.CAT} />
            <AttendanceCheck label="Exam attendance" check={report.attendanceReview.assessments.EXAM} />
            <article className="report-attendance-check report-attendance-class-check">
              <div><strong>Class attendance</strong><span>{report.attendanceReview.classAttendance.percentage === null ? 'Not available' : `${report.attendanceReview.classAttendance.percentage}%`}</span></div>
              {report.attendanceReview.classAttendance.percentage === null
                ? <small>No completed class sessions are available for this academic year.</small>
                : <small>{report.attendanceReview.classAttendance.attendedSessions} of {report.attendanceReview.classAttendance.applicableSessions} sessions · {report.attendanceReview.classAttendance.meetsRequirement ? 'meets' : 'below'} the {report.attendanceReview.classAttendance.minimumPercentage}% threshold</small>}
            </article>
          </div>
          <p className="report-attendance-review-note">Attendance information is advisory; review the student’s report before deciding.</p>
        </section>
      )}
      <div className="form-grid">
        <form className="details-card" onSubmit={(event) => { event.preventDefault(); act(() => addLecturerReportComment(reportId, comment.trim())).then(() => setComment('')) }}>
          <h3>Feedback to student</h3><p>This feedback will be visible to the student on their report.</p><textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} required placeholder="Share relevant feedback or information" /><button className="button button-secondary" disabled={busy || !comment.trim()}>Send feedback</button>
        </form>
        <form className="details-card" onSubmit={(event) => { event.preventDefault(); act(() => decideLecturerReport(reportId, decisionPayload('APPROVE'))) }}>
          <h3>Decision</h3><label htmlFor="decision-reason">Reason</label><textarea id="decision-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} required />
          <label htmlFor="assessment-type">What assessment was missed?</label>
          <select id="assessment-type" value={assessmentTypeId} onChange={(event) => { setAssessmentTypeId(event.target.value); setAssessmentTypeOtherDescription('') }} required disabled={!assessmentTypes.length}>
            <option value="">{assessmentTypes.length ? 'Select the missed assessment' : 'No assessment options available'}</option>
            {assessmentTypes.map((type) => <option key={type.id} value={type.id}>{type.name || type.code}</option>)}
          </select>
          {!assessmentTypes.length && <small role="status">Assessment options are unavailable. Contact an administrator before recording a decision.</small>}
          {isOtherAssessmentType && <><label htmlFor="assessment-type-other-description">Describe the assessment</label><input id="assessment-type-other-description" value={assessmentTypeOtherDescription} onChange={(event) => setAssessmentTypeOtherDescription(event.target.value)} maxLength={2000} required /></>}
          <div className="record-actions"><button className="button button-primary" disabled={busy || !canSubmitDecision}>Approve</button><button type="button" className="button button-secondary" disabled={busy || !canSubmitDecision || !reason.trim()} onClick={() => act(() => decideLecturerReport(reportId, decisionPayload('REJECT')))}>Reject</button></div>
        </form>
        <form className="details-card" onSubmit={(event) => { event.preventDefault(); act(() => escalateLecturerReport(reportId, { reason: escalation.trim() })).then(() => setEscalation('')) }}>
          <h3>Escalate to COD</h3><textarea value={escalation} onChange={(event) => setEscalation(event.target.value)} maxLength={2000} required placeholder="Reason for escalation" /><button className="button button-secondary" disabled={busy || !escalation.trim()}>Escalate</button>
        </form>
        <form className="details-card" onSubmit={(event) => { event.preventDefault(); act(() => submitLecturerCorrection(reportId, { proposedValue: Number(correctionValue), reason: correctionReason.trim() })).then(() => { setCorrectionValue(''); setCorrectionReason('') }) }}>
          <h3>Propose mark correction</h3><label htmlFor="proposed-mark">Proposed mark</label><input id="proposed-mark" type="number" step="0.01" min="0" value={correctionValue} onChange={(event) => setCorrectionValue(event.target.value)} required /><label htmlFor="correction-reason">Justification</label><textarea id="correction-reason" value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} maxLength={2000} required /><button className="button button-secondary" disabled={busy}>Submit correction</button>
        </form>
      </div>
      <section className="details-card" style={{ marginTop: 18 }}><h3>Comments</h3>{comments.length ? comments.map((item, index) => <p key={item.id || index}><strong>{item.author?.displayName || item.authorName || 'User'}:</strong> {item.body || item.comment}</p>) : <p>No comments yet.</p>}</section>
    </section>
  )
}
