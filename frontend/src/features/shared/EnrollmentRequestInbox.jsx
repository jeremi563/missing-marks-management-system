import { useEffect, useMemo, useState } from 'react'
import { Check, CheckCheck, Clock3, RefreshCw, Search, X } from 'lucide-react'
import { decideCodEnrollmentRequests, getCodEnrollmentRequests } from '../../api/cod'
import { decideLecturerEnrollmentRequests, getLecturerEnrollmentRequests } from '../../api/lecturer'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import ConfirmationDialog from '../../components/ui/ConfirmationDialog'
import './EnrollmentRequestInbox.css'

const STATUS_TABS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Declined' },
]

export default function EnrollmentRequestInbox({ audience = 'lecturer' }) {
  const [requests, setRequests] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [status, setStatus] = useState('PENDING')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmation, setConfirmation] = useState(null)
  const [refresh, setRefresh] = useState(0)
  const isCod = audience === 'cod'
  const loadRequests = isCod ? getCodEnrollmentRequests : getLecturerEnrollmentRequests
  const decideRequests = isCod ? decideCodEnrollmentRequests : decideLecturerEnrollmentRequests

  useEffect(() => {
    let active = true
    loadRequests({ status })
      .then((response) => {
        const data = response?.data ?? response
        if (!Array.isArray(data)) throw new Error('The server returned invalid enrollment requests.')
        if (!active) return
        setRequests(data)
        setSelectedIds([])
        setError('')
      })
      .catch((requestError) => {
        if (active) setError(requestError.userMessage || requestError.message || 'Unable to load enrollment requests.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [loadRequests, status, refresh])

  const visibleRequests = useMemo(() => requests.filter((request) => {
    const text = [
      request.student.user?.displayName,
      request.student.studentNumber,
      request.courseUnit.code,
      request.courseUnit.name,
      request.courseUnit.department.name,
      request.academicPeriod.name,
    ].join(' ').toLowerCase()
    return text.includes(search.trim().toLowerCase())
  }), [requests, search])

  const toggleRequest = (id) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
    setError('')
  }

  const toggleAllVisible = () => {
    const allSelected = visibleRequests.length > 0 && visibleRequests.every(({ id }) => selectedIds.includes(id))
    setSelectedIds((current) => allSelected
      ? current.filter((id) => !visibleRequests.some((request) => request.id === id))
      : [...new Set([...current, ...visibleRequests.map(({ id }) => id)])])
  }

  const decide = (decision) => {
    if (!selectedIds.length) return
    setConfirmation({ decision, requestIds: [...selectedIds] })
  }

  const confirmDecision = async () => {
    if (!confirmation) return
    const { decision, requestIds } = confirmation
    setConfirmation(null)
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const count = requestIds.length
      await decideRequests({ requestIds, decision })
      setSelectedIds([])
      setNotice(`${count} request${count === 1 ? '' : 's'} ${decision === 'APPROVE' ? 'approved' : 'declined'}.`)
      setRefresh((value) => value + 1)
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to update these enrollment requests.')
    } finally {
      setBusy(false)
    }
  }

  const retry = () => {
    setLoading(true)
    setError('')
    setRefresh((value) => value + 1)
  }

  const pending = status === 'PENDING'
  const title = isCod ? 'Department enrollment requests' : 'Course enrollment requests'

  return (
    <section className="enrollment-inbox-page">
      <header className="page-heading enrollment-inbox-heading">
        <div>
          <p className="eyebrow">{isCod ? 'COD WORKSPACE' : 'LECTURER PORTAL'}</p>
          <h2>{title}</h2>
          <p>{isCod
            ? 'Review requests across your designated departments, alongside the course lecturers.'
            : 'Review requests for course units assigned to you, including courses across departments.'}</p>
        </div>
        <button className="button button-secondary" type="button" onClick={retry}><RefreshCw size={16} /> Refresh</button>
      </header>

      {error && <div className="form-alert" role="alert">{error}</div>}
      {notice && <div className="form-success" role="status">{notice}</div>}

      <div className="enrollment-inbox-toolbar">
        <div className="enrollment-inbox-tabs" role="tablist" aria-label="Filter enrollment requests">
          {STATUS_TABS.map((tab) => (
            <button type="button" role="tab" aria-selected={status === tab.value} className={status === tab.value ? 'active' : ''} key={tab.value} onClick={() => { setStatus(tab.value); setSelectedIds([]) }}>
              {tab.label}
            </button>
          ))}
        </div>
        <label className="enrollment-inbox-search">
          <Search size={17} aria-hidden="true" />
          <input aria-label="Search enrollment requests" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search students or courses" />
        </label>
      </div>

      {pending && !loading && visibleRequests.length > 0 && (
        <div className="enrollment-bulk-bar">
          <label className="enrollment-select-all">
            <input type="checkbox" checked={visibleRequests.every(({ id }) => selectedIds.includes(id))} onChange={toggleAllVisible} />
            <span>{selectedIds.length ? `${selectedIds.length} selected` : 'Select all pending'}</span>
          </label>
          <div className="enrollment-bulk-actions">
            <button className="button button-secondary enrollment-reject-button" type="button" disabled={!selectedIds.length || busy} onClick={() => decide('REJECT')}><X size={15} /> Decline</button>
            <button className="button button-primary" type="button" disabled={!selectedIds.length || busy} onClick={() => decide('APPROVE')}><CheckCheck size={16} /> Approve selected</button>
          </div>
        </div>
      )}

      {loading ? <LoadingState message="Loading enrollment requests…" /> :
        error && !requests.length ? <ErrorState title="Requests unavailable" message={error} onRetry={retry} /> :
          !visibleRequests.length ? (
            <EmptyState
              title={search ? 'No matching requests' : `No ${status.toLowerCase()} requests`}
              message={search ? 'Try another student, course, or department search.' : pending ? 'New student requests for your assigned courses and departments will appear here.' : 'Decisions you have access to will appear here.'}
            />
          ) : (
            <div className="enrollment-request-list">
              {visibleRequests.map((request) => (
                <article className={`enrollment-review-card${selectedIds.includes(request.id) ? ' selected' : ''}`} key={request.id}>
                  {pending && (
                    <label className="enrollment-request-checkbox" aria-label={`Select ${request.student.user?.displayName || request.student.studentNumber}'s ${request.courseUnit.code} request`}>
                      <input type="checkbox" checked={selectedIds.includes(request.id)} onChange={() => toggleRequest(request.id)} />
                      <span>{selectedIds.includes(request.id) && <Check size={14} />}</span>
                    </label>
                  )}
                  <span className="enrollment-request-avatar">{(request.student.user?.displayName || request.student.studentNumber || 'S').trim().slice(0, 1).toUpperCase()}</span>
                  <div className="enrollment-request-student">
                    <strong>{request.student.user?.displayName || 'Student'}</strong>
                    <span>{request.student.studentNumber}</span>
                  </div>
                  <div className="enrollment-request-course">
                    <strong>{request.courseUnit.code}</strong>
                    <span>{request.courseUnit.name}</span>
                  </div>
                  <div className="enrollment-request-meta">
                    <span>{request.courseUnit.department.name}</span>
                    <small>{request.academicPeriod.name}</small>
                  </div>
                  <div className={`enrollment-request-state ${request.status.toLowerCase()}`}>
                    {request.status === 'PENDING' ? <Clock3 size={14} /> : request.status === 'APPROVED' ? <CheckCheck size={14} /> : <X size={14} />}
                    {request.status.toLowerCase()}
                  </div>
                  <time>{new Date(request.createdAt).toLocaleDateString()}</time>
                </article>
              ))}
            </div>
          )}
      {confirmation && (
        <ConfirmationDialog
          title={`${confirmation.decision === 'APPROVE' ? 'Approve' : 'Decline'} enrollment requests?`}
          description={`This will ${confirmation.decision === 'APPROVE' ? 'approve' : 'decline'} ${confirmation.requestIds.length} selected enrollment request${confirmation.requestIds.length === 1 ? '' : 's'}.`}
          confirmLabel={confirmation.decision === 'APPROVE' ? 'Approve requests' : 'Decline requests'}
          destructive={confirmation.decision === 'REJECT'}
          onCancel={() => setConfirmation(null)}
          onConfirm={confirmDecision}
        />
      )}
    </section>
  )
}
