import { useCallback, useEffect, useState } from 'react'
import {
  addCodReportComment,
  decideCodReport,
  getCodReport,
  getCodReportComments,
  getCodDepartmentLecturers,
  reassignCodReport,
} from '../../api/cod'
import { extractRecords } from '../shared/recordUtils'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import StatusChip from '../../components/ui/StatusChip'

function unwrap(response) {
  const first = response?.data ?? response
  return first?.data ?? first
}

export default function CodReportPanel({ reportId, onClose }) {
  const [report, setReport] = useState(null)
  const [comments, setComments] = useState([])
  const [lecturers, setLecturers] = useState([])
  const [comment, setComment] = useState('')
  const [decisionReason, setDecisionReason] = useState('')
  const [reassignmentReason, setReassignmentReason] = useState('')
  const [lecturerProfileId, setLecturerProfileId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const reportResponse = await getCodReport(reportId)
    const report = unwrap(reportResponse)
    const [commentsResponse, lecturerResponse] = await Promise.all([
      report.status?.toUpperCase() === 'ESCALATED' ? getCodReportComments(reportId) : Promise.resolve(null),
      report.courseUnit?.departmentId
        ? getCodDepartmentLecturers({ departmentId: report.courseUnit.departmentId, page: 1, limit: 100 })
        : Promise.resolve(null),
    ])
    return {
      report,
      comments: commentsResponse ? extractRecords(commentsResponse, ['comments']) : [],
      lecturers: lecturerResponse ? extractRecords(lecturerResponse) : [],
    }
  }, [reportId])
  useEffect(() => {
    let active = true
    load().then((data) => {
      if (!active) return
      setReport(data.report)
      setComments(data.comments)
      setLecturers(data.lecturers.filter(({ lecturerProfile }) => lecturerProfile?.id))
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
      setLecturers(data.lecturers.filter(({ lecturerProfile }) => lecturerProfile?.id))
      setError('')
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to complete this report action.')
    } finally {
      setBusy(false)
    }
  }
  if (loading) return <LoadingState message="Loading report…" />
  if (!report) return <ErrorState title="Report unavailable" message={error || 'No report details were returned.'} onRetry={() => { setLoading(true); load().catch((e) => setError(e.userMessage || 'Unable to load report.')).finally(() => setLoading(false)) }} />
  const isEscalated = report.status?.toUpperCase() === 'ESCALATED'
  const isOutstanding = !['APPROVED', 'REJECTED', 'WITHDRAWN'].includes(report.status?.toUpperCase())

  return (
    <section className="panel" style={{ marginTop: 22 }}>
      <header className="page-heading"><div><p className="eyebrow">DEPARTMENT REVIEW</p><h2>{report.reference || report.reportNumber || `Report ${report.id}`}</h2><p>{report.courseUnit?.name || report.courseUnit?.code || 'Course unit'} · {report.student?.displayName || report.student?.studentNumber || 'Student'}</p></div><div className="record-actions"><StatusChip status={report.status} /><button className="button button-secondary" onClick={onClose}>Close</button></div></header>
      {error && <div className="form-alert" role="alert">{error}</div>}
      <p>{report.description || report.reason || 'No description provided.'}</p>
      <div className="form-grid">
        {isOutstanding && <form className="details-card" onSubmit={(event) => {
          event.preventDefault()
          act(() => reassignCodReport(reportId, { lecturerProfileId, reason: reassignmentReason.trim() }))
        }}>
          <h3>Reassign report</h3>
          <p>Current lecturer: {report.assignedLecturer?.user?.displayName || 'Unassigned'}</p>
          <label htmlFor="cod-reassignment-lecturer">New lecturer</label>
          <select id="cod-reassignment-lecturer" value={lecturerProfileId} onChange={(event) => setLecturerProfileId(event.target.value)} required>
            <option value="">Select an active department lecturer</option>
            {lecturers.map(({ lecturerProfile, displayName, email }) => (
              <option key={lecturerProfile.id} value={lecturerProfile.id}>{displayName || email}</option>
            ))}
          </select>
          <label htmlFor="cod-reassignment-reason">Reason</label>
          <textarea id="cod-reassignment-reason" value={reassignmentReason} onChange={(event) => setReassignmentReason(event.target.value)} maxLength={2000} required />
          <button className="button button-primary" disabled={busy || !lecturerProfileId || !reassignmentReason.trim()}>Reassign</button>
        </form>}
        {isEscalated && <>
          <form className="details-card" onSubmit={(event) => { event.preventDefault(); act(() => decideCodReport(reportId, { decision: 'APPROVE', reason: decisionReason.trim() })) }}>
            <h3>Department decision</h3><label htmlFor="cod-decision-reason">Reason</label><textarea id="cod-decision-reason" value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} maxLength={2000} required />
            <div className="record-actions"><button className="button button-primary" disabled={busy}>Approve</button><button type="button" className="button button-secondary" disabled={busy || !decisionReason.trim()} onClick={() => act(() => decideCodReport(reportId, { decision: 'REJECT', reason: decisionReason.trim() }))}>Reject</button></div>
          </form>
          <form className="details-card" onSubmit={(event) => { event.preventDefault(); act(() => addCodReportComment(reportId, comment.trim())).then(() => setComment('')) }}>
            <h3>Comment</h3><textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={2000} required placeholder="Add a department comment" /><button className="button button-secondary" disabled={busy || !comment.trim()}>Add comment</button>
          </form>
        </>}
      </div>
      {isEscalated && <section className="details-card" style={{ marginTop: 18 }}><h3>Comments</h3>{comments.length ? comments.map((item, index) => <p key={item.id || index}><strong>{item.author?.displayName || item.authorName || 'User'}:</strong> {item.body || item.comment}</p>) : <p>No comments yet.</p>}</section>}
    </section>
  )
}
