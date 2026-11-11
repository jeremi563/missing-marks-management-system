import { useCallback, useEffect, useState } from 'react'
import { getCodAppeal, getCodSpecialCase, decideCodAppeal, decideCodSpecialCase } from '../../api/cod'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import StatusChip from '../../components/ui/StatusChip'

function unwrap(response) {
  const first = response?.data ?? response
  return first?.data ?? first
}

export default function CodDecisionPanel({ id, type, onClose }) {
  const isAppeal = type === 'appeal'
  const [record, setRecord] = useState(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const response = isAppeal ? await getCodAppeal(id) : await getCodSpecialCase(id)
    return unwrap(response)
  }, [id, isAppeal])
  useEffect(() => {
    let active = true
    load().then((data) => {
      if (!active) return
      setRecord(data)
      setError('')
    }).catch((requestError) => { if (active) setError(requestError.userMessage || 'Unable to load case details.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [load])

  const decide = async (decision) => {
    setBusy(true)
    setError('')
    try {
      const payload = { decision, reason: reason.trim() }
      if (isAppeal) await decideCodAppeal(id, payload)
      else await decideCodSpecialCase(id, payload)
      const data = await load()
      setRecord(data)
      setReason('')
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to submit the decision.')
    } finally {
      setBusy(false)
    }
  }
  if (loading) return <LoadingState message="Loading case details…" />
  if (!record) return <ErrorState title="Case unavailable" message={error || 'No case details were returned.'} />
  return (
    <section className="panel" style={{ marginTop: 22 }}>
      <header className="page-heading"><div><p className="eyebrow">{isAppeal ? 'APPEAL REVIEW' : 'SPECIAL CASE REVIEW'}</p><h2>{record.reference || record.id || (isAppeal ? 'Appeal' : 'Special case')}</h2><p>{record.student?.displayName || record.student?.studentNumber || record.category?.name || ''}</p></div><div className="record-actions"><StatusChip status={record.status} /><button className="button button-secondary" onClick={onClose}>Close</button></div></header>
      {error && <div className="form-alert" role="alert">{error}</div>}
      <p>{record.reason || record.description || record.comments || 'No additional details provided.'}</p>
      <label htmlFor="cod-case-reason">Decision reason</label>
      <textarea id="cod-case-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={2000} required />
      <div className="record-actions" style={{ marginTop: 12 }}>
        <button className="button button-primary" disabled={busy || !reason.trim()} onClick={() => decide('APPROVE')}>Approve</button>
        <button className="button button-secondary" disabled={busy || !reason.trim()} onClick={() => decide('REJECT')}>Reject</button>
      </div>
    </section>
  )
}
