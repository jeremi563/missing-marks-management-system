import { useCallback, useEffect, useState } from 'react'
import { Check, RefreshCw, X } from 'lucide-react'
import { decideLecturerApproval, getPendingLecturerApprovals } from '../../api/cod'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import { extractRecords } from '../shared/recordUtils'

export default function CodApprovals() {
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [refresh, setRefresh] = useState(0)

  const load = useCallback(async () => {
    const response = await getPendingLecturerApprovals()
    return extractRecords(response, ['users', 'accounts', 'items'])
  }, [])

  useEffect(() => {
    let active = true
    load().then((users) => {
      if (!active) return
      setPending(users)
      setError('')
    }).catch((requestError) => {
      if (active) setError(requestError.userMessage || 'Unable to load lecturer approval requests.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [load, refresh])

  const decide = async (user, status) => {
    setBusyId(user.id)
    setError('')
    try {
      await decideLecturerApproval(user.id, status)
      setRefresh((value) => value + 1)
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to save the lecturer approval decision.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <section>
      <header className="page-heading">
        <div><p className="eyebrow">DEPARTMENT WORKSPACE</p><h2>Lecturer approvals</h2><p>Review and decide applications submitted to your designated department.</p></div>
        <button className="button button-secondary" type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} /> Refresh</button>
      </header>
      {error && <div className="form-alert" role="alert">{error}</div>}
      {loading ? <LoadingState message="Loading lecturer approval requests…" /> :
        error && pending.length === 0 ? <ErrorState title="Unable to load approval requests" message={error} onRetry={() => setRefresh((value) => value + 1)} /> :
          pending.length === 0 ? <EmptyState title="No pending lecturer applications" message="New applications for your department will appear here after department registration." /> : (
            <div className="records-grid">
              {pending.map((user) => {
                const department = user.departmentMemberships?.[0]?.department
                const staffNumber = user.lecturerProfile?.staffNumber ||
                  user.loginIdentifiers?.find(({ type }) => type === 'STAFF_NUMBER')?.value ||
                  'Staff number unavailable'
                return (
                  <article className="record-card" key={user.id}>
                    <div>
                      <h3>{user.displayName || user.email}</h3>
                      <p>{user.email} · {staffNumber}</p>
                      <small>{department?.name || 'Department unavailable'}{department?.code ? ` · ${department.code}` : ''}</small>
                      <small>Department registration complete · Awaiting COD decision</small>
                    </div>
                    <div className="record-actions">
                      <button className="button button-primary" type="button" disabled={busyId === user.id} onClick={() => decide(user, 'APPROVED')}><Check size={15} /> Approve</button>
                      <button className="button button-secondary" type="button" disabled={busyId === user.id} onClick={() => decide(user, 'REJECTED')}><X size={15} /> Reject</button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
    </section>
  )
}
