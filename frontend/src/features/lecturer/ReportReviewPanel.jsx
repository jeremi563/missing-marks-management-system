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

export default function ReportReviewPanel({ reportId, onClose }) {
  const [report, setReport] = useState(null)
  const [comments, setComments] = useState([])
  const [assessmentTypes, setAssessmentTypes] = useState([])
  const [assessmentTypeId, setAssessmentTypeId] = useState('')
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

  return (
    <section className="panel" style={{ marginTop: 22 }}>
      <header className="page-heading"><div><p className="eyebrow">REPORT REVIEW</p><h2>{report.reference || report.reportNumber || `Report ${report.id}`}</h2><p>{report.courseUnit?.name || report.courseUnit?.code || 'Course unit'} · {report.student?.displayName || report.student?.name || report.student?.studentNumber || 'Student'}</p></div><div className="record-actions"><StatusChip status={report.status} /><button className="button button-secondary" onClick={onClose}>Close</button></div></header>
      {error && <div className="form-alert" role="alert">{error}</div>}
      <p>{report.description || report.reason || 'No description provided.'}</p>
      <div className="form-grid">
        <form className="details-card" onSubmit={(event) => { event.preventDefault(); act(() => addLecturerReportComment(reportId, comment.trim())).then(() => setComment('')) }}>
          <h3>Clarification</h3><textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} required placeholder="Add a comment to the report" /><button className="button button-secondary" disabled={busy || !comment.trim()}>Add comment</button>
        </form>
        <form className="details-card" onSubmit={(event) => { event.preventDefault(); act(() => decideLecturerReport(reportId, { decision: 'APPROVE', reason: reason.trim(), assessmentTypeId })) }}>
          <h3>Decision</h3><label htmlFor="decision-reason">Reason</label><textarea id="decision-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} required />
          {assessmentTypes.length ? <><label htmlFor="assessment-type">Assessment type</label><select id="assessment-type" value={assessmentTypeId} onChange={(event) => setAssessmentTypeId(event.target.value)} required><option value="">Select type</option>{assessmentTypes.map((type) => <option key={type.id} value={type.id}>{type.name || type.code}</option>)}</select></> : <><label htmlFor="assessment-type-id">Assessment type UUID</label><input id="assessment-type-id" value={assessmentTypeId} onChange={(event) => setAssessmentTypeId(event.target.value)} required /></>}
          <div className="record-actions"><button className="button button-primary" disabled={busy || !assessmentTypeId}>Approve</button><button type="button" className="button button-secondary" disabled={busy || !assessmentTypeId || !reason.trim()} onClick={() => act(() => decideLecturerReport(reportId, { decision: 'REJECT', reason: reason.trim(), assessmentTypeId }))}>Reject</button></div>
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
