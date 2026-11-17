import { useCallback, useEffect, useState } from 'react'
import { decideCodSpecialCase, getCodSpecialCase } from '../../api/cod'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import StatusChip from '../../components/ui/StatusChip'
import EvidenceList from '../shared/EvidenceList'

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

export default function CodSpecialCaseDecisionPanel({ id, hasSchedulingConfig, onClose, onDecision }) {
  const [record, setRecord] = useState(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => unwrap(await getCodSpecialCase(id)), [id])

  useEffect(() => {
    let active = true
    load().then((data) => {
      if (active) {
        setRecord(data)
        setError('')
      }
    }).catch((requestError) => {
      if (active) setError(requestError.userMessage || 'Unable to load application details.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [load])

  const decide = async (decision) => {
    if (!record || !reason.trim()) return
    setBusy(true)
    setError('')
    try {
      await decideCodSpecialCase(id, { decision, reason: reason.trim() })
      setRecord(await load())
      setReason('')
      onDecision?.()
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to submit the final decision.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingState message="Loading special-case application…" />
  if (!record) return <ErrorState title="Application unavailable" message={error || 'No application details were returned.'} />

  const standalone = !record.reportId
  const recommendation = record.reviews?.slice().reverse().find(({ reviewerRole, action }) => reviewerRole === 'LECTURER' && action === 'RECOMMENDATION')
  const awaitingDecision = standalone
    ? record.status === 'PENDING_COD_REVIEW' && Boolean(recommendation)
    : record.status?.toLowerCase() === 'submitted'

  return (
    <article className="panel cod-special-case-detail">
      <header className="page-heading">
        <div><p className="eyebrow">COD FINAL REVIEW</p><h3>{record.student?.user?.displayName || record.student?.studentNumber || record.id}</h3><p>{record.student?.studentNumber} · {record.courseUnit?.code} · {record.assessment?.name}</p></div>
        <div className="record-actions"><StatusChip status={record.status} /><button type="button" className="button button-secondary" onClick={onClose}>Close</button></div>
      </header>
      {error && <div className="form-alert" role="alert">{error}</div>}
      <dl className="special-case-detail-grid">
        <div><dt>Course unit</dt><dd>{record.courseUnit?.code} · {record.courseUnit?.name}</dd></div>
        <div><dt>Academic period</dt><dd>{record.academicPeriod?.name}</dd></div>
        <div><dt>Assessment</dt><dd>{record.assessment?.name} · {formatDate(record.assessment?.assessmentDate, true)}</dd></div>
        <div><dt>Category</dt><dd>{record.categoryRecord?.name || record.category}</dd></div>
        <div><dt>Submitted</dt><dd>{formatDate(record.submittedAt || record.createdAt, true)}</dd></div>
        <div><dt>Scheduling deadline</dt><dd>{formatDate(record.schedulingDeadlineAt, true)}</dd></div>
      </dl>
      <section className="details-card"><h4>Student explanation</h4><p>{record.description || record.reason}</p></section>
      <EvidenceList evidence={record.evidence} title="Supporting evidence" />

      <section className="details-card">
        <h4>Lecturer recommendation</h4>
        {recommendation
          ? <><p><strong>{recommendation.decision?.replaceAll('_', ' ')}</strong> · {formatDate(recommendation.createdAt, true)}</p><p>{recommendation.comments}</p></>
          : <p>{standalone ? 'No lecturer recommendation is recorded. A final decision is unavailable until lecturer review is complete.' : 'Legacy report-linked case; no standalone recommendation stage applies.'}</p>}
      </section>

      {record.reviews?.filter(({ reviewerRole }) => reviewerRole === 'COD').map((review) => (
        <section className="details-card" key={review.id}><h4>Previous COD decision</h4><p>{review.decision} · {formatDate(review.createdAt, true)}</p><p>{review.comments}</p></section>
      ))}

      {record.schedules?.length > 0 && (
        <section className="details-card">
          <h4>Assessment schedule history</h4>
          {record.schedules.map((schedule) => <p key={schedule.id}>Schedule {schedule.version} · {schedule.status} · {formatDate(schedule.startsAt, true)} – {formatDate(schedule.endsAt, true)} · {schedule.venue}{schedule.acknowledgedAt ? ` · Acknowledged ${formatDate(schedule.acknowledgedAt, true)}` : ''}{schedule.changeReason ? ` · ${schedule.changeReason}` : ''}</p>)}
        </section>
      )}
      {record.attendances?.length > 0 && (
        <section className="details-card">
          <h4>Recorded attendance</h4>
          {record.attendances.map((attendance) => <p key={attendance.id}>{attendance.outcome?.replaceAll('_', ' ')} · {formatDate(attendance.recordedAt, true)}{attendance.remarks ? ` · ${attendance.remarks}` : ''}</p>)}
        </section>
      )}

      {awaitingDecision && (
        <section className="details-card cod-special-case-actions">
          <h4>Final decision</h4>
          {standalone && !hasSchedulingConfig && <p className="special-case-note">Configure the department's scheduling period before approving this application. Rejection remains available.</p>}
          <label htmlFor="cod-special-case-reason">Decision reason / feedback<textarea id="cod-special-case-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} required rows={4} /></label>
          <div className="record-actions">
            <button type="button" className="button button-primary" disabled={busy || !reason.trim() || (standalone && !hasSchedulingConfig)} onClick={() => decide('APPROVE')}>{busy ? 'Saving…' : 'Approve'}</button>
            <button type="button" className="button button-secondary" disabled={busy || !reason.trim()} onClick={() => decide('REJECT')}>Reject</button>
          </div>
        </section>
      )}
      {record.decisionAt && !awaitingDecision && <section className="details-card"><h4>Final decision</h4><p>{record.status} · {formatDate(record.decisionAt, true)}</p><p>{record.decisionReason}</p></section>}
    </article>
  )
}
