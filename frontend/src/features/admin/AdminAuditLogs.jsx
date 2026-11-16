import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import Pager from '../../components/ui/Pager'
import { getAdminAuditLogs } from '../../api/admin'
import { extractRecords } from '../shared/recordUtils'

const emptyDraft = { action: '', entityType: '', actorId: '', from: '', to: '' }
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0, total: 0 })
  const [filters, setFilters] = useState({})
  const [draft, setDraft] = useState(emptyDraft)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterError, setFilterError] = useState('')
  const [refresh, setRefresh] = useState(0)

  const load = useCallback(async () => getAdminAuditLogs({ page, limit: 20, ...filters }), [filters, page])

  useEffect(() => {
    let active = true
    load().then((response) => {
      if (!active) return
      setLogs(extractRecords(response, ['logs']))
      setPagination(response?.pagination || { page, totalPages: 0, total: 0 })
      setError('')
    }).catch((requestError) => {
      if (active) setError(requestError.userMessage || 'Unable to load audit logs.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [load, page, refresh])

  const applyFilters = (event) => {
    event.preventDefault()
    setFilterError('')
    const from = draft.from ? new Date(draft.from) : null
    const to = draft.to ? new Date(draft.to) : null
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
      setFilterError('Enter valid date and time values.')
      return
    }
    if (from && to && to < from) {
      setFilterError('The end date must be on or after the start date.')
      return
    }
    if (draft.actorId.trim() && !uuidPattern.test(draft.actorId.trim())) {
      setFilterError('Actor ID must be a valid UUID.')
      return
    }
    setFilters({
      ...(draft.action.trim() ? { action: draft.action.trim() } : {}),
      ...(draft.entityType.trim() ? { entityType: draft.entityType.trim() } : {}),
      ...(draft.actorId.trim() ? { actorId: draft.actorId.trim() } : {}),
      ...(from ? { from: from.toISOString() } : {}),
      ...(to ? { to: to.toISOString() } : {}),
    })
    setPage(1)
    setError('')
    setLoading(true)
    setRefresh((value) => value + 1)
  }

  const clearFilters = () => {
    setDraft(emptyDraft)
    setFilters({})
    setFilterError('')
    setPage(1)
    setError('')
    setLoading(true)
    setRefresh((value) => value + 1)
  }

  const refreshLogs = () => {
    setLoading(true)
    setError('')
    setRefresh((value) => value + 1)
  }

  const changePage = (nextPage) => {
    setLoading(true)
    setPage(nextPage)
  }

  return (
    <section>
      <header className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h2>Audit logs</h2>
          <p>Review actor-attributed system actions and workflow history.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={refreshLogs}>
          <RefreshCw size={16} /> Refresh
        </button>
      </header>

      <form className="panel form-stack" onSubmit={applyFilters}>
        <h3>Filter audit events</h3>
        {filterError && <p className="form-alert" role="alert">{filterError}</p>}
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="admin-audit-action">Action</label>
            <input id="admin-audit-action" value={draft.action} maxLength={120} onChange={(event) => setDraft((current) => ({ ...current, action: event.target.value }))} />
          </div>
          <div className="form-field">
            <label htmlFor="admin-audit-entity-type">Entity type</label>
            <input id="admin-audit-entity-type" value={draft.entityType} maxLength={120} onChange={(event) => setDraft((current) => ({ ...current, entityType: event.target.value }))} />
          </div>
          <div className="form-field">
            <label htmlFor="admin-audit-actor">Actor ID</label>
            <input id="admin-audit-actor" value={draft.actorId} onChange={(event) => setDraft((current) => ({ ...current, actorId: event.target.value }))} aria-describedby="admin-audit-actor-hint" />
            <small id="admin-audit-actor-hint">Use the actor’s UUID to filter events.</small>
          </div>
          <div className="form-field">
            <label htmlFor="admin-audit-from">From</label>
            <input id="admin-audit-from" type="datetime-local" value={draft.from} onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))} />
          </div>
          <div className="form-field">
            <label htmlFor="admin-audit-to">Through</label>
            <input id="admin-audit-to" type="datetime-local" value={draft.to} onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))} />
          </div>
        </div>
        <div className="record-actions">
          <button className="button button-primary" type="submit">Apply filters</button>
          <button className="button button-secondary" type="button" onClick={clearFilters}>Clear filters</button>
        </div>
      </form>

      {!loading && !error && <p className="field-hint" role="status">{pagination.total} audit event(s) match the applied filters.</p>}
      {loading ? <LoadingState message="Loading audit logs…" /> :
        error ? <ErrorState title="Unable to load audit logs" message={error} onRetry={() => setRefresh((value) => value + 1)} /> :
          logs.length === 0 ? <EmptyState title="No audit events found" message="No audit events match the applied filters." /> : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Time</th><th>Action</th><th>Entity</th><th>Entity ID</th><th>Actor</th><th>Metadata</th></tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatDate(log.createdAt)}</td>
                        <td>{log.action}</td>
                        <td>{log.entityType}</td>
                        <td>{log.entityId || '—'}</td>
                        <td>{log.actor?.displayName || log.actor?.email || 'System'}</td>
                        <td><pre>{log.metadata == null ? '—' : JSON.stringify(log.metadata, null, 2)}</pre></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagination.totalPages > 1 && <Pager page={page} totalPages={pagination.totalPages} onChange={changePage} />}
            </>
          )}
    </section>
  )
}
