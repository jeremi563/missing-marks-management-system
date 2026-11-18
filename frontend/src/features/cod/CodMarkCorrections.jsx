import { useCallback, useEffect, useState } from 'react'
import {
  decideCodMarkCorrection,
  getCodDepartments,
  getCodMarkCorrection,
  getCodMarkCorrections,
} from '../../api/cod'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import StatusChip from '../../components/ui/StatusChip'
import { extractRecords, formatMarkValue } from '../shared/recordUtils'

function unwrap(response) {
  const first = response?.data ?? response
  return first?.data ?? first
}

export default function CodMarkCorrections() {
  const [departments, setDepartments] = useState([])
  const [items, setItems] = useState([])
  const [departmentId, setDepartmentId] = useState('')
  const [status, setStatus] = useState('PENDING_REVIEW')
  const [selected, setSelected] = useState(null)
  const [comments, setComments] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadQueue = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getCodMarkCorrections({ status, ...(departmentId ? { departmentId } : {}) })
      setItems(extractRecords(response))
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to load mark corrections.')
    } finally {
      setLoading(false)
    }
  }, [departmentId, status])

  useEffect(() => {
    let active = true
    getCodDepartments()
      .then((response) => { if (active) setDepartments(extractRecords(response)) })
      .catch((requestError) => { if (active) setError(requestError.userMessage || 'Unable to load authorized departments.') })
    return () => { active = false }
  }, [])

  useEffect(() => { loadQueue() }, [loadQueue])

  const openCorrection = async (id) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      setSelected(unwrap(await getCodMarkCorrection(id)))
      setComments('')
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to load correction details.')
    } finally {
      setBusy(false)
    }
  }

  const decide = async (decision) => {
    if (decision === 'REJECT' && !comments.trim()) {
      setError('A reason is required to reject a correction.')
      return
    }
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      await decideCodMarkCorrection(selected.id, { decision, comments: comments.trim() })
      setNotice(`Correction ${decision === 'APPROVE' ? 'approved' : 'rejected'}.`)
      setSelected(null)
      setComments('')
      await loadQueue()
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to record the correction decision.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <header className="page-heading">
        <div>
          <p className="eyebrow">COD PORTAL</p>
          <h2>Mark correction review</h2>
          <p>Review proposals from lecturers assigned to your departments.</p>
        </div>
      </header>
      {error && <div className="form-alert" role="alert">{error}</div>}
      {notice && <div className="form-success" role="status">{notice}</div>}
      <section className="panel">
        <div className="form-grid">
          <label>Department
            <select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
              <option value="">All authorized departments</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </label>
          <label>Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="PENDING_REVIEW">Pending review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </label>
        </div>
        {loading
          ? <LoadingState message="Loading correction queue…" />
          : items.length === 0
            ? <EmptyState title="No mark corrections" message="No corrections match this department and status." />
            : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Report</th><th>Student</th><th>Course unit</th><th>Assessment</th><th>Proposed</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.report.reference}</td>
                        <td>{item.report.student.user.displayName || item.report.student.studentNumber}</td>
                        <td>{item.report.courseUnit.code}</td>
                        <td>{item.report.assessment?.name || 'Assessment unavailable'}</td>
                        <td>{formatMarkValue(item.proposedValue)}</td>
                        <td><StatusChip status={item.status} /></td>
                        <td><button className="button button-secondary" type="button" disabled={busy} onClick={() => openCorrection(item.id)}>Review</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      </section>
      {selected && (
        <section className="panel" style={{ marginTop: 20 }}>
          <header className="page-heading">
            <div><p className="eyebrow">CORRECTION DETAILS</p><h3>{selected.report.reference}</h3></div>
            <div className="record-actions"><StatusChip status={selected.status} /><button className="button button-secondary" type="button" onClick={() => setSelected(null)}>Close</button></div>
          </header>
          <p><strong>Student:</strong> {selected.report.student.user.displayName || selected.report.student.studentNumber} · {selected.report.student.studentNumber}</p>
          <p><strong>Course unit:</strong> {selected.report.courseUnit.code} · {selected.report.courseUnit.name}</p>
          <p><strong>Assessment:</strong> {selected.report.assessment?.name || 'Unavailable'} · {selected.report.academicPeriod.name}</p>
          <p><strong>Original mark:</strong> {selected.originalValue == null ? 'No official mark existed when proposed' : formatMarkValue(selected.originalValue)}</p>
          <p><strong>Proposed mark:</strong> {formatMarkValue(selected.proposedValue)}</p>
          <p><strong>Lecturer reason:</strong> {selected.reason}</p>
          {!selected.baselineVerified && selected.status === 'PENDING_REVIEW' && <div className="form-alert" role="alert">This legacy proposal has no verified baseline. It cannot be approved; reject it with an explanation so the lecturer can submit a verified proposal.</div>}
          {selected.reviewComments && <p><strong>Review comments:</strong> {selected.reviewComments}</p>}
          {selected.status === 'PENDING_REVIEW' && (
            <div className="details-card">
              <label htmlFor="correction-review-comments">Review comments</label>
              <textarea id="correction-review-comments" value={comments} onChange={(event) => setComments(event.target.value)} maxLength={2000} placeholder="Required when rejecting" />
              <div className="record-actions">
                <button className="button button-primary" type="button" disabled={busy || !selected.baselineVerified} onClick={() => decide('APPROVE')}>{busy ? 'Saving…' : 'Approve'}</button>
                <button className="button button-secondary" type="button" disabled={busy || !comments.trim()} onClick={() => decide('REJECT')}>Reject</button>
              </div>
            </div>
          )}
          {selected.decidedAt && <p><strong>Decision recorded:</strong> {new Date(selected.decidedAt).toLocaleString()} {selected.reviewedBy?.displayName ? `by ${selected.reviewedBy.displayName}` : ''}{selected.finalValue != null ? ` · final mark ${formatMarkValue(selected.finalValue)}` : ''}</p>}
        </section>
      )}
      {error && !items.length && <ErrorState title="Unable to load corrections" message={error} onRetry={loadQueue} />}
    </section>
  )
}
