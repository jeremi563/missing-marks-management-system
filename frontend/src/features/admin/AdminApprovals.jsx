import { useCallback, useEffect, useState } from 'react'
import { Check, RefreshCw, X } from 'lucide-react'
import { decideStaffAccountApproval, getPendingStaffAccounts } from '../../api/admin'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import { extractRecords } from '../shared/recordUtils'

export default function AdminApprovals() {
  const [pending, setPending] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refresh, setRefresh] = useState(0)
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    const response = await getPendingStaffAccounts({ page: 1, limit: 100 })
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
      await decideStaffAccountApproval(user.id, { status })
      setRefresh((value) => value + 1)
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to update lecturer approval.')
    } finally {
      setBusyId('')
    }
  }

  return (
    <section>
      <header className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h2>Lecturer approvals</h2>
          <p>Review lecturer applications after the applicant has selected a department. COD assignments are managed in Academic setup.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => setRefresh((value) => value + 1)}>
          <RefreshCw size={16} /> Refresh
        </button>
      </header>
      {error && <div className="form-alert" role="alert">{error}</div>}
      {loading ? <LoadingState message="Loading lecturer approval requests…" /> :
        error ? <ErrorState title="Unable to load approval requests" message={error} onRetry={() => setRefresh((value) => value + 1)} /> :
          pending.length === 0 ? <EmptyState title="No pending requests" message="New lecturer registrations will appear here after submission." /> : (
            <div className="records-grid">
              {pending.map((user) => {
                const name = user.displayName || user.fullName || user.email
                const staffNumber = user.lecturerProfile?.staffNumber ||
                  user.loginIdentifiers?.find(({ type }) => type === 'STAFF_NUMBER')?.value ||
                  'Staff number unavailable'

                return (
                  <article className="record-card" key={user.id}>
                    <div>
                      <h3>{name}</h3>
                      <p>{user.email} · {staffNumber}</p>
                      {user.departmentMemberships?.map(({ department }) => <small key={department.id}>{department.name}{department.code ? ` (${department.code})` : ''}</small>)}
                      <small>
                        {user.emailVerifiedAt
                          ? 'Awaiting department COD approval; administrator review is also available.'
                          : 'Email verification is not required; awaiting department COD approval.'}
                      </small>
                    </div>
                    <div className="record-actions">
                      <button
                        className="button button-primary"
                        type="button"
                        disabled={busyId === user.id}
                        onClick={() => decide(user, 'APPROVED')}
                      >
                        <Check size={15} /> Approve
                      </button>
                      <button
                        className="button button-secondary"
                        type="button"
                        disabled={busyId === user.id}
                        onClick={() => decide(user, 'REJECTED')}
                      >
                        <X size={15} /> Reject
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
    </section>
  )
}
