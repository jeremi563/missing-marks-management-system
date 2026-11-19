import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, Clock, FileText } from 'lucide-react'
import {
  cancelLecturerSpecialCase,
  getLecturerSpecialCase,
  getLecturerSpecialCases,
  recommendLecturerSpecialCase,
  recordLecturerSpecialCaseAttendance,
  rescheduleLecturerSpecialCase,
  scheduleLecturerSpecialCase,
} from '../../api/lecturer'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import StatusChip from '../../components/ui/StatusChip'
import EvidenceList from '../shared/EvidenceList'
import { fetchAllRecordPages } from '../shared/recordUtils'
import './LecturerSpecialCases.css'

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

function schedulePayload(startsAt, endsAt, venue) {
  return { startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), venue: venue.trim() }
}

export default function LecturerSpecialCases() {
  const [cases, setCases] = useState([])
  const [selected, setSelected] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [recommendation, setRecommendation] = useState('')
  const [reviewReason, setReviewReason] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [venue, setVenue] = useState('')
  const [changeReason, setChangeReason] = useState('')
  const [attendance, setAttendance] = useState('')
  const [attendanceRemarks, setAttendanceRemarks] = useState('')
  const [cancellationReason, setCancellationReason] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadCases = useCallback(async () => {
    const response = await getLecturerSpecialCases({
      page: 1,
      limit: 100,
      ...(statusFilter ? { status: statusFilter } : {}),
    })
    setCases(await fetchAllRecordPages(
      (page) => getLecturerSpecialCases({ page, limit: 100, ...(statusFilter ? { status: statusFilter } : {}) }),
      response,
      ['items', 'cases', 'specialCases'],
    ))
  }, [statusFilter])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await loadCases()
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to load assigned special cases.')
    } finally {
      setLoading(false)
    }
  }, [loadCases])

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => { if (active) return load() })
    return () => { active = false }
  }, [load])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const refreshSelected = async () => {
    await loadCases()
    if (selected?.id) setSelected(unwrap(await getLecturerSpecialCase(selected.id)))
  }

  const openCase = async (item) => {
    setDetailLoading(true)
    setSelected(null)
    setError('')
    setRecommendation('')
    setReviewReason('')
    setStartsAt('')
    setEndsAt('')
    setVenue('')
    setChangeReason('')
    setAttendance('')
    setAttendanceRemarks('')
    setCancellationReason('')
    try {
      setSelected(unwrap(await getLecturerSpecialCase(item.id)))
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to load application details.')
    } finally {
      setDetailLoading(false)
    }
  }

  const perform = async (action, successMessage) => {
    if (!selected) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
      await refreshSelected()
      setNotice(successMessage)
      setReviewReason('')
      setChangeReason('')
      setAttendance('')
      setAttendanceRemarks('')
      setCancellationReason('')
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to update this special case.')
    } finally {
      setBusy(false)
    }
  }

  const submitRecommendation = (event) => {
    event.preventDefault()
    if (!reviewReason.trim()) return
    perform(
      () => recommendLecturerSpecialCase(selected.id, { recommendation, reason: reviewReason.trim() }),
      'Your recommendation was submitted to the COD.',
    )
  }

  const submitSchedule = (event) => {
    event.preventDefault()
    if (!startsAt || !endsAt || !venue.trim()) return
    const payload = schedulePayload(startsAt, endsAt, venue)
    perform(
      () => scheduleLecturerSpecialCase(selected.id, payload),
      'The assessment schedule was sent to the student.',
    )
  }

  const submitReschedule = (event) => {
    event.preventDefault()
    if (!startsAt || !endsAt || !venue.trim() || !changeReason.trim()) return
    const payload = { ...schedulePayload(startsAt, endsAt, venue), reason: changeReason.trim() }
    perform(
      () => rescheduleLecturerSpecialCase(selected.id, payload),
      'The revised schedule was sent to the student for fresh acknowledgement.',
    )
  }

  const submitAttendance = (event) => {
    event.preventDefault()
    if (!attendance) return
    perform(
      () => recordLecturerSpecialCaseAttendance(selected.id, { outcome: attendance, remarks: attendanceRemarks.trim() || undefined }),
      attendance === 'ATTENDED' ? 'Attendance recorded and case completed.' : 'Non-attendance recorded for departmental resolution.',
    )
  }

  const schedule = selected?.schedules?.slice().reverse().find(({ status }) => status === 'SCHEDULED')
  const lecturerReview = selected?.reviews?.slice().reverse().find(({ reviewerRole, action }) => reviewerRole === 'LECTURER' && action === 'RECOMMENDATION')
  const canRecordAttendance = schedule && new Date(schedule.endsAt).valueOf() <= now && selected.status === 'SCHEDULED'

  if (loading) return <LoadingState message="Loading assigned special cases…" />
  if (error && !cases.length) return <ErrorState title="Special cases unavailable" message={error} onRetry={load} />

  return (
    <section className="lecturer-special-cases">
      <header className="page-heading">
        <div><p className="eyebrow">LECTURER PORTAL</p><h2>Special cases</h2><p>Review cases assigned to your course units, recommend an outcome, and manage approved assessments.</p></div>
      </header>
      {error && <div className="form-alert" role="alert">{error}</div>}
      {notice && <div className="form-alert success" role="status">{notice}</div>}

      <div className="panel special-case-inbox">
        <div className="special-case-inbox-heading">
          <h3>Assigned applications</h3>
          <label>Filter by status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              {['PENDING_LECTURER_REVIEW', 'PENDING_COD_REVIEW', 'PENDING_SCHEDULING', 'SCHEDULED', 'COMPLETED', 'DID_NOT_ATTEND', 'REJECTED', 'CANCELLED'].map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
            </select>
          </label>
        </div>
        {!cases.length ? <div className="special-case-empty"><FileText size={28} /><p>No applications are assigned to you for this filter.</p></div> : (
          <div className="special-case-inbox-list">
            {cases.map((item) => (
              <article className="special-case-inbox-item" key={item.id}>
                <div>
                  <h4>{item.student?.user?.displayName || item.student?.studentNumber || 'Student application'}</h4>
                  <p>{item.student?.studentNumber} · {item.courseUnit?.code} · {item.assessment?.name}</p>
                  <small>{item.academicPeriod?.name} · Submitted {formatDate(item.submittedAt || item.createdAt)}</small>
                </div>
                <div className="record-actions"><StatusChip status={item.status} /><button type="button" className="button button-secondary" onClick={() => openCase(item)}>Review</button></div>
              </article>
            ))}
          </div>
        )}
      </div>

      {detailLoading && <LoadingState message="Loading application…" />}
      {selected && (
        <article className="panel lecturer-special-case-detail">
          <header className="page-heading">
            <div><p className="eyebrow">APPLICATION REVIEW</p><h3>{selected.student?.user?.displayName || selected.student?.studentNumber}</h3><p>{selected.student?.studentNumber} · {selected.courseUnit?.code} · {selected.assessment?.name}</p></div>
            <div className="record-actions"><StatusChip status={selected.status} /><button type="button" className="button button-secondary" onClick={() => setSelected(null)}>Close</button></div>
          </header>
          <dl className="special-case-detail-grid">
            <div><dt>Academic period</dt><dd>{selected.academicPeriod?.name}</dd></div>
            <div><dt>Assessment date</dt><dd>{formatDate(selected.assessment?.assessmentDate, true)}</dd></div>
            <div><dt>Category</dt><dd>{selected.categoryRecord?.name || selected.category}</dd></div>
            <div><dt>Submitted</dt><dd>{formatDate(selected.submittedAt || selected.createdAt, true)}</dd></div>
          </dl>
          <section className="details-card"><h4>Student explanation</h4><p>{selected.description}</p></section>
          <EvidenceList evidence={selected.evidence} title="Supporting evidence" />

          {lecturerReview && <section className="details-card"><h4>Your recommendation</h4><p><strong>{lecturerReview.decision?.replaceAll('_', ' ')}</strong></p><p>{lecturerReview.comments}</p></section>}

          {selected.status === 'PENDING_LECTURER_REVIEW' && (
            <form className="details-card special-case-action-form" onSubmit={submitRecommendation}>
              <h4>Submit recommendation</h4>
              <label>Recommendation
                <select value={recommendation} onChange={(event) => setRecommendation(event.target.value)} required>
                  <option value="">Choose a recommendation</option>
                  <option value="RECOMMEND_APPROVAL">Recommend approval</option>
                  <option value="RECOMMEND_REJECTION">Recommend rejection</option>
                </select>
              </label>
              <label>Reason / comments<textarea value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} maxLength={2000} required rows={4} /></label>
              <button className="button button-primary" disabled={busy || !recommendation || !reviewReason.trim()}>{busy ? 'Submitting…' : 'Submit recommendation'}</button>
            </form>
          )}

          {selected.status === 'PENDING_SCHEDULING' && (
            <form className="details-card special-case-action-form" onSubmit={submitSchedule}>
              <h4>Schedule the approved assessment</h4>
              <p><Clock size={15} /> Scheduling deadline: {formatDate(selected.schedulingDeadlineAt, true)}</p>
              <label>Assessment start<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required /></label>
              <label>Assessment end<input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required /></label>
              <label>Physical venue<input value={venue} onChange={(event) => setVenue(event.target.value)} maxLength={300} required /></label>
              <button className="button button-primary" disabled={busy || !startsAt || !endsAt || !venue.trim()}>{busy ? 'Scheduling…' : 'Schedule assessment'}</button>
              <label>Cancellation reason<textarea value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} maxLength={2000} rows={2} /></label>
              <button type="button" className="button button-secondary" disabled={busy || !cancellationReason.trim()} onClick={() => perform(() => cancelLecturerSpecialCase(selected.id, cancellationReason.trim()), 'The approved case was cancelled and the student notified.')}>Cancel approved case</button>
            </form>
          )}

          {schedule && (
            <section className="details-card special-case-action-form">
              <h4>Current assessment schedule</h4>
              <p>{formatDate(schedule.startsAt, true)} – {formatDate(schedule.endsAt, true)} · {schedule.venue}</p>
              <p>{schedule.acknowledgedAt ? `Student acknowledged ${formatDate(schedule.acknowledgedAt, true)}` : 'Awaiting student acknowledgement'}</p>
              {selected.status === 'SCHEDULED' && (
                <form className="special-case-action-form" onSubmit={submitReschedule}>
                  <h4>Reschedule assessment</h4>
                  <label>New start<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required /></label>
                  <label>New end<input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required /></label>
                  <label>New physical venue<input value={venue} onChange={(event) => setVenue(event.target.value)} maxLength={300} required /></label>
                  <label>Reason for rescheduling<textarea value={changeReason} onChange={(event) => setChangeReason(event.target.value)} maxLength={2000} required rows={3} /></label>
                  <button className="button button-primary" disabled={busy || !startsAt || !endsAt || !venue.trim() || !changeReason.trim()}>{busy ? 'Rescheduling…' : 'Save revised schedule'}</button>
                  <label>Cancellation reason<textarea value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} maxLength={2000} rows={2} /></label>
                  <button type="button" className="button button-secondary" disabled={busy || !cancellationReason.trim()} onClick={() => perform(() => cancelLecturerSpecialCase(selected.id, cancellationReason.trim()), 'The scheduled assessment was cancelled and the student notified.')}>Cancel assessment</button>
                </form>
              )}
              {canRecordAttendance && (
                <form className="special-case-action-form" onSubmit={submitAttendance}>
                  <h4>Record assessment attendance</h4>
                  <label>Outcome
                    <select value={attendance} onChange={(event) => setAttendance(event.target.value)} required>
                      <option value="">Select an outcome</option>
                      <option value="ATTENDED">Attended</option>
                      <option value="DID_NOT_ATTEND">Did not attend</option>
                    </select>
                  </label>
                  <label>Remarks (optional)<textarea value={attendanceRemarks} onChange={(event) => setAttendanceRemarks(event.target.value)} maxLength={2000} rows={2} /></label>
                  <button className="button button-primary" disabled={busy || !attendance}><CheckCircle size={16} />{busy ? 'Recording…' : 'Record attendance'}</button>
                </form>
              )}
            </section>
          )}

          {selected.schedules?.length > 1 && <section className="details-card"><h4>Schedule history</h4>{selected.schedules.map((entry) => <p key={entry.id}>Schedule {entry.version} · {entry.status} · {formatDate(entry.startsAt, true)} · {entry.venue}{entry.changeReason ? ` · ${entry.changeReason}` : ''}</p>)}</section>}
          {selected.status === 'DID_NOT_ATTEND' && <section className="details-card"><h4>Non-attendance resolution</h4><p>This case requires departmental resolution. No assessment marks were changed.</p></section>}
          {selected.attendances?.length > 0 && <section className="details-card"><h4>Recorded attendance</h4>{selected.attendances.map((entry) => <p key={entry.id}>{entry.outcome.replaceAll('_', ' ')} · {formatDate(entry.recordedAt, true)}{entry.remarks ? ` · ${entry.remarks}` : ''}</p>)}</section>}
          {selected.reviews?.filter(({ reviewerRole }) => reviewerRole === 'COD').map((entry) => <section className="details-card" key={entry.id}><h4>COD decision</h4><p>{entry.decision} · {formatDate(entry.createdAt, true)}</p><p>{entry.comments}</p></section>)}
        </article>
      )}
    </section>
  )
}
