import { useCallback, useEffect, useState } from 'react'
import {
  decideLecturerExamAttendance,
  getLecturerCourseUnitAssessments,
  getLecturerCourseUnits,
  getLecturerExamAttendance,
  getLecturerExamAttendanceRecord,
} from '../../api/lecturer'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import { extractRecords } from '../shared/recordUtils'

function unwrap(response) {
  const first = response?.data ?? response
  return first?.data ?? first
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : 'Not available'
}

export default function LecturerExamAttendance() {
  const [courseUnits, setCourseUnits] = useState([])
  const [assessments, setAssessments] = useState([])
  const [records, setRecords] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0 })
  const [selected, setSelected] = useState(null)
  const [status, setStatus] = useState('PENDING_REVIEW')
  const [courseUnitId, setCourseUnitId] = useState('')
  const [assessmentId, setAssessmentId] = useState('')
  const [page, setPage] = useState(1)
  const [reason, setReason] = useState('')
  const [comments, setComments] = useState('')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadRecords = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await getLecturerExamAttendance({
        page,
        limit: 20,
        ...(status ? { status } : {}),
        ...(courseUnitId ? { courseUnitId } : {}),
        ...(assessmentId ? { assessmentId } : {}),
      })
      const payload = response?.pagination ? response : response?.data ?? response
      setRecords(Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : payload?.items ?? [])
      setPagination(payload?.pagination ?? { page, totalPages: 0 })
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to load examination attendance.')
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
    Promise.resolve().then(() => { if (active) return loadRecords() })
    return () => { active = false }
  }, [loadRecords])

  useEffect(() => {
    if (!courseUnitId) return undefined
    let active = true
    getLecturerCourseUnitAssessments(courseUnitId, 'EXAM')
      .then((response) => { if (active) setAssessments(extractRecords(response)) })
      .catch((requestError) => { if (active) setError(requestError.userMessage || 'Unable to load exam assessments.') })
    return () => { active = false }
  }, [courseUnitId])

  const openRecord = async (id) => {
    setSelected(null)
    setReason('')
    setComments('')
    setDetailLoading(true)
    setError('')
    setNotice('')
    try {
      setSelected(unwrap(await getLecturerExamAttendanceRecord(id)))
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to load this examination attendance record.')
    } finally {
      setDetailLoading(false)
    }
  }

  const decide = async (decision) => {
    if (decision === 'REJECT' && !reason.trim()) {
      setError('Enter a rejection reason before rejecting this attendance record.')
      return
    }
    if (!selected) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await decideLecturerExamAttendance(selected.id, {
        decision,
        ...(decision === 'REJECT' ? { reason: reason.trim() } : {}),
        ...(decision === 'VERIFY' && comments.trim() ? { comments: comments.trim() } : {}),
      })
      setSelected(unwrap(response))
      setNotice(decision === 'VERIFY' ? 'Examination attendance verified.' : 'Examination attendance rejected.')
      await loadRecords()
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to record the examination attendance decision.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <header className="page-heading">
        <div>
          <p className="eyebrow">LECTURER PORTAL</p>
          <h2>Examination attendance review</h2>
          <p>Verify examination check-ins recorded during sessions you own.</p>
        </div>
      </header>

      {error && <ErrorState message={error} onRetry={loadRecords} />}
      {notice && <div className="form-success" role="status">{notice}</div>}

      <section className="panel">
        <div className="form-grid">
          <label>Status
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); setSelected(null) }}>
              <option value="PENDING_REVIEW">Pending review</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
              <option value="LEGACY_UNVERIFIED">Legacy, outcome unknown</option>
              <option value="">All statuses</option>
            </select>
          </label>
          <label>Course unit
            <select value={courseUnitId} onChange={(event) => { setCourseUnitId(event.target.value); setAssessments([]); setAssessmentId(''); setPage(1); setSelected(null) }}>
              <option value="">All assigned units</option>
              {courseUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}
            </select>
          </label>
          <label>Exam assessment
            <select value={assessmentId} disabled={!courseUnitId} onChange={(event) => { setAssessmentId(event.target.value); setPage(1); setSelected(null) }}>
              <option value="">All exam assessments</option>
              {assessments.map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.code || assessment.name} · {assessment.name}</option>)}
            </select>
          </label>
        </div>
      </section>

      {loading
        ? <LoadingState message="Loading examination attendance…" />
        : records.length === 0
          ? <EmptyState title="No examination attendance" message="Records matching these filters will appear here." />
          : (
            <section className="panel">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Student</th><th>Assessment</th><th>Course unit</th><th>Check-in</th><th>Status</th><th>Review</th></tr></thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={record.id}>
                        <td>{record.student?.user?.displayName || 'Student'}<small>{record.student?.studentNumber}</small></td>
                        <td>{record.session?.assessment?.code || record.session?.assessment?.name || 'Exam'}</td>
                        <td>{record.session?.courseUnit?.code} · {record.session?.courseUnit?.name}</td>
                        <td>{formatDate(record.recordedAt)}</td>
                        <td>{record.examVerificationStatus?.replaceAll('_', ' ') || 'Unknown'}</td>
                        <td><button className="button button-secondary" type="button" onClick={() => openRecord(record.id)}>View</button></td>
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

      {detailLoading && <LoadingState message="Loading attendance details…" />}
      {selected && (
        <section className="panel" aria-label="Examination attendance details">
          <h3>{selected.session?.assessment?.name || 'Examination attendance'}</h3>
          <p><strong>Student:</strong> {selected.student?.user?.displayName || 'Student'} ({selected.student?.studentNumber})</p>
          <p><strong>Course unit:</strong> {selected.session?.courseUnit?.code} · {selected.session?.courseUnit?.name}</p>
          <p><strong>Check-in:</strong> {formatDate(selected.recordedAt)} · {selected.locationVerified ? 'Location verified' : 'Location not verified'}</p>
          <p><strong>Session:</strong> {formatDate(selected.session?.startsAt)} · {selected.session?.classroom?.name || 'Classroom unavailable'}</p>
          <p><strong>Academic year:</strong> {selected.academicYear || 'Not available'}</p>
          <p><strong>Verification status:</strong> {selected.examVerificationStatus?.replaceAll('_', ' ') || 'Unknown'}</p>
          {(selected.examVerificationActorAt || selected.examVerifiedAt) && (
            <p><strong>Verification recorded:</strong> {formatDate(selected.examVerificationActorAt || selected.examVerifiedAt)}
              {selected.examVerificationMethod ? ` by ${selected.examVerificationActor?.displayName || 'authenticated user'} (${selected.examVerificationMethod.replaceAll('_', ' ')})` : selected.examVerifiedBy?.user?.displayName ? ` by ${selected.examVerifiedBy.user.displayName}` : ''}
            </p>
          )}
          {selected.examRejectionReason && <p><strong>Rejection reason:</strong> {selected.examRejectionReason}</p>}
          {selected.examComments && <p><strong>Verification comments:</strong> {selected.examComments}</p>}
          {selected.examVerificationStatus === 'PENDING_REVIEW' && (
            <div className="form-grid">
              <label>Verification comments (optional)
                <textarea value={comments} onChange={(event) => setComments(event.target.value)} maxLength={2000} />
              </label>
              <label>Rejection reason (required to reject)
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} />
              </label>
              <div className="form-actions">
                <button className="button button-primary" type="button" disabled={busy} onClick={() => decide('VERIFY')}>{busy ? 'Saving…' : 'Verify attendance'}</button>
                <button className="button button-secondary" type="button" disabled={busy || !reason.trim()} onClick={() => decide('REJECT')}>{busy ? 'Saving…' : 'Reject attendance'}</button>
              </div>
            </div>
          )}
        </section>
      )}
    </section>
  )
}
