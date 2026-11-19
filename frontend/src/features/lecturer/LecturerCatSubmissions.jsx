import { useCallback, useEffect, useState } from 'react'
import {
  decideLecturerCatSubmissions,
  decideLecturerCatSubmission,
  getLecturerCatSubmission,
  getLecturerCatSubmissions,
  getLecturerCourseUnitAssessments,
  getLecturerCourseUnits,
} from '../../api/lecturer'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import { extractRecords } from '../shared/recordUtils'
import './LecturerCatSubmissions.css'

function unwrap(response) {
  const first = response?.data ?? response
  return first?.data ?? first
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : 'Not available'
}

export default function LecturerCatSubmissions() {
  const [courseUnits, setCourseUnits] = useState([])
  const [assessments, setAssessments] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0 })
  const [selected, setSelected] = useState(null)
  const [status, setStatus] = useState('PENDING_REVIEW')
  const [courseUnitId, setCourseUnitId] = useState('')
  const [assessmentId, setAssessmentId] = useState('')
  const [reason, setReason] = useState('')
  const [comments, setComments] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [bulkComments, setBulkComments] = useState('')
  const [bulkReason, setBulkReason] = useState('')
  const [bulkRejecting, setBulkRejecting] = useState(false)

  const loadSubmissions = useCallback(async () => {
    setLoading(true)
    setError('')
    setSelectedIds([])
    setBulkComments('')
    setBulkReason('')
    setBulkRejecting(false)
    try {
      const response = await getLecturerCatSubmissions({
        page,
        limit: 20,
        ...(status ? { status } : {}),
        ...(courseUnitId ? { courseUnitId } : {}),
        ...(assessmentId ? { assessmentId } : {}),
      })
      const payload = response?.pagination ? response : response?.data ?? response
      setSubmissions(Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : payload?.items ?? [])
      setPagination(payload?.pagination ?? { page, totalPages: 0 })
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to load CAT submissions.')
    } finally {
      setLoading(false)
    }
  }, [assessmentId, courseUnitId, page, status])

  useEffect(() => {
    let active = true
    getLecturerCourseUnits()
      .then((response) => {
        if (active) setCourseUnits(extractRecords(response).map(({ courseUnit }) => courseUnit).filter(Boolean))
      })
      .catch((requestError) => { if (active) setError(requestError.userMessage || 'Unable to load assigned course units.') })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => { if (active) return loadSubmissions() })
    return () => { active = false }
  }, [loadSubmissions])

  useEffect(() => {
    if (!courseUnitId) return undefined
    let active = true
    getLecturerCourseUnitAssessments(courseUnitId, 'CAT')
      .then((response) => { if (active) setAssessments(extractRecords(response)) })
      .catch((requestError) => { if (active) setError(requestError.userMessage || 'Unable to load CAT assessments.') })
    return () => { active = false }
  }, [courseUnitId])

  const openSubmission = async (id) => {
    setSelected(null)
    setReason('')
    setComments('')
    setDetailLoading(true)
    setError('')
    try {
      setSelected(unwrap(await getLecturerCatSubmission(id)))
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to load this CAT submission.')
    } finally {
      setDetailLoading(false)
    }
  }

  const decide = async (decision) => {
    if (decision === 'REJECT' && !reason.trim()) {
      setError('Enter a rejection reason before rejecting this submission.')
      return
    }
    if (!selected) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await decideLecturerCatSubmission(selected.id, {
        decision,
        ...(decision === 'REJECT' ? { reason: reason.trim() } : {}),
        ...(decision === 'VERIFY' && comments.trim() ? { comments: comments.trim() } : {}),
      })
      setSelected(unwrap(response))
      setNotice(decision === 'VERIFY' ? 'CAT submission verified.' : 'CAT submission rejected.')
      await loadSubmissions()
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to record the CAT submission decision.')
    } finally {
      setBusy(false)
    }
  }

  const decideSelected = async (decision) => {
    if (selectedIds.length === 0) return
    if (decision === 'REJECT' && !bulkReason.trim()) {
      setError('Enter a rejection reason before rejecting selected submissions.')
      return
    }

    setBusy(true)
    setError('')
    setNotice('')
    try {
      await decideLecturerCatSubmissions({
        submissionIds: selectedIds,
        decision,
        ...(decision === 'REJECT' ? { reason: bulkReason.trim() } : {}),
        ...(decision === 'VERIFY' && bulkComments.trim() ? { comments: bulkComments.trim() } : {}),
      })
      setNotice(`${selectedIds.length} CAT submissions ${decision === 'VERIFY' ? 'verified' : 'rejected'}.`)
      setSelected(null)
      setSelectedIds([])
      setBulkComments('')
      setBulkReason('')
      setBulkRejecting(false)
      await loadSubmissions()
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to record the selected CAT submission decisions.')
    } finally {
      setBusy(false)
    }
  }

  const pendingIds = submissions
    .filter((submission) => submission.status === 'PENDING_REVIEW')
    .map(({ id }) => id)
  const allPendingSelected = pendingIds.length > 0 && pendingIds.every((id) => selectedIds.includes(id))

  return (
    <section className="cat-submissions-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">LECTURER PORTAL</p>
          <h2>CAT submission review</h2>
          <p>Review CAT submissions created from verified attendance check-ins.</p>
        </div>
      </header>

      {error && <ErrorState message={error} onRetry={loadSubmissions} />}
      {notice && <div className="form-success" role="status">{notice}</div>}

      {pendingIds.length > 0 && (
        <section className="panel cat-submission-bulk-actions" aria-label="Bulk CAT submission review">
          <label>
            <input
              type="checkbox"
              aria-label="Select all pending submissions on this page"
              checked={allPendingSelected}
              disabled={busy || loading}
              onChange={(event) => setSelectedIds(event.target.checked ? pendingIds : [])}
            />
            Select all pending submissions on this page
          </label>
          <span>{selectedIds.length} selected</span>
          {bulkRejecting ? (
            <div className="cat-submission-bulk-rejection">
              <label>Reason for rejecting selected submissions
                <textarea
                  aria-label="Bulk rejection reason"
                  value={bulkReason}
                  onChange={(event) => setBulkReason(event.target.value)}
                  maxLength={2000}
                  required
                  disabled={busy || loading}
                />
              </label>
              <div className="form-actions">
                <button className="button button-secondary" type="button" disabled={busy || loading} onClick={() => { setBulkRejecting(false); setBulkReason('') }}>Cancel</button>
                <button className="button button-primary" type="button" disabled={busy || loading || !selectedIds.length || !bulkReason.trim()} onClick={() => decideSelected('REJECT')}>
                  {busy ? 'Saving…' : `Reject ${selectedIds.length} selected`}
                </button>
              </div>
            </div>
          ) : (
            <>
              <label>Verification comments (optional)
                <textarea
                  aria-label="Bulk verification comments"
                  value={bulkComments}
                  onChange={(event) => setBulkComments(event.target.value)}
                  maxLength={2000}
                  disabled={!selectedIds.length || busy || loading}
                />
              </label>
              <div className="form-actions">
                <button className="button button-primary" type="button" disabled={busy || loading || !selectedIds.length} onClick={() => decideSelected('VERIFY')}>
                  {busy ? 'Saving…' : `Verify ${selectedIds.length} selected`}
                </button>
                <button className="button button-secondary" type="button" disabled={busy || loading || !selectedIds.length} onClick={() => { setBulkRejecting(true); setBulkReason(''); setError('') }}>
                  Reject selected
                </button>
              </div>
            </>
          )}
        </section>
      )}

      <section className="panel">
        <div className="form-grid">
          <label>Status
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); setSelected(null) }}>
              <option value="PENDING_REVIEW">Pending review</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
              <option value="">All statuses</option>
            </select>
          </label>
          <label>Course unit
            <select value={courseUnitId} onChange={(event) => { setCourseUnitId(event.target.value); setAssessments([]); setAssessmentId(''); setPage(1); setSelected(null) }}>
              <option value="">All assigned units</option>
              {courseUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}
            </select>
          </label>
          <label>CAT assessment
            <select value={assessmentId} disabled={!courseUnitId} onChange={(event) => { setAssessmentId(event.target.value); setPage(1); setSelected(null) }}>
              <option value="">All CAT assessments</option>
              {assessments.map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.code || assessment.name} · {assessment.name}</option>)}
            </select>
          </label>
        </div>
      </section>

      {loading
        ? <LoadingState message="Loading CAT submissions…" />
        : submissions.length === 0
          ? <EmptyState title="No CAT submissions" message="Submissions matching these filters will appear here." />
          : (
            <section className="panel">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Select</th><th>Student</th><th>Assessment</th><th>Course unit</th><th>Submitted</th><th>Status</th><th>Review</th></tr></thead>
                  <tbody>
                    {submissions.map((submission) => (
                      <tr key={submission.id}>
                        <td><input type="checkbox" aria-label={`Select ${submission.student?.user?.displayName || submission.student?.studentNumber || 'student'} CAT submission`} checked={selectedIds.includes(submission.id)} disabled={submission.status !== 'PENDING_REVIEW' || busy} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...new Set([...current, submission.id])] : current.filter((id) => id !== submission.id))} /></td>
                        <td>{submission.student?.user?.displayName || 'Student'}<small>{submission.student?.studentNumber}</small></td>
                        <td>{submission.assessment?.code || submission.assessment?.name}</td>
                        <td>{submission.assessment?.courseUnit?.code} · {submission.assessment?.courseUnit?.name}</td>
                        <td>{formatDate(submission.createdAt)}</td>
                        <td>{submission.status.replaceAll('_', ' ')}</td>
                        <td><button className="button button-secondary" type="button" onClick={() => openSubmission(submission.id)}>View</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="form-actions">
                <button className="button button-secondary" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
                <span>Page {pagination.page || page} of {pagination.totalPages || 1}</span>
                <button className="button button-secondary" type="button" disabled={page >= (pagination.totalPages || 1)} onClick={() => setPage((value) => value + 1)}>Next</button>
              </div>
            </section>
          )}

      {detailLoading && <LoadingState message="Loading submission details…" />}
      {selected && (
        <section className="panel" aria-label="CAT submission details">
          <h3>{selected.assessment?.name || 'CAT submission'}</h3>
          <p><strong>Student:</strong> {selected.student?.user?.displayName || 'Student'} ({selected.student?.studentNumber})</p>
          <p><strong>Course unit:</strong> {selected.assessment?.courseUnit?.code} · {selected.assessment?.courseUnit?.name}</p>
          <p><strong>Status:</strong> {selected.status.replaceAll('_', ' ')}</p>
          <p><strong>CAT session:</strong> {formatDate(selected.attendanceRecord?.session?.startsAt)}</p>
          <p><strong>Check-in:</strong> {formatDate(selected.attendanceRecord?.recordedAt)} · {selected.attendanceRecord?.locationVerified ? 'Location verified' : 'Location not verified'}</p>
          <p><strong>Academic year:</strong> {selected.academicYear || 'Not available'}</p>
          {selected.verifiedAt && <p><strong>Decision recorded:</strong> {formatDate(selected.verifiedAt)}{selected.verifiedBy?.user?.displayName ? ` by ${selected.verifiedBy.user.displayName}` : ''}</p>}
          {selected.rejectionReason && <p><strong>Rejection reason:</strong> {selected.rejectionReason}</p>}
          {selected.comments && <p><strong>Verification comments:</strong> {selected.comments}</p>}
          {selected.status === 'PENDING_REVIEW' && (
            <div className="form-grid">
              <label>Verification comments (optional)
                <textarea value={comments} onChange={(event) => setComments(event.target.value)} maxLength={2000} />
              </label>
              <label>Rejection reason (required to reject)
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} />
              </label>
              <div className="form-actions">
                <button className="button button-primary" type="button" disabled={busy} onClick={() => decide('VERIFY')}>{busy ? 'Saving…' : 'Verify submission'}</button>
                <button className="button button-secondary" type="button" disabled={busy || !reason.trim()} onClick={() => decide('REJECT')}>{busy ? 'Saving…' : 'Reject submission'}</button>
              </div>
            </div>
          )}
        </section>
      )}
    </section>
  )
}
