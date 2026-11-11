import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import StatusChip from '../../components/ui/StatusChip'
import { extractRecords } from './recordUtils'

function recordTitle(record) {
  return record.reference || record.reportNumber || record.name || record.title ||
    record.email || record.id || 'Record'
}

export default function RecordListPage({
  title,
  description,
  fetchRecords,
  collectionKeys = [],
  renderActions,
  emptyMessage = 'There are no records to show.',
}) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [search, setSearch] = useState('')

  const collectionKey = collectionKeys.join(',')
  const load = useCallback(async () => {
    const response = await fetchRecords({ page: 1, limit: 100 })
    return extractRecords(response, collectionKey ? collectionKey.split(',') : [])
  }, [fetchRecords, collectionKey])

  useEffect(() => {
    let active = true
    load().then((items) => {
      if (!active) return
      setRecords(items)
      setError('')
    }).catch((requestError) => {
      if (active) setError(requestError.userMessage || 'Unable to load records.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [load, refresh])

  const filtered = records.filter((record) =>
    JSON.stringify(record).toLowerCase().includes(search.toLowerCase())
  )

  return (
    <section>
      <header className="page-heading">
        <div><p className="eyebrow">WORKSPACE</p><h2>{title}</h2><p>{description}</p></div>
        <button className="button button-secondary" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} /> Refresh</button>
      </header>
      <div className="toolbar">
        <input aria-label={`Search ${title.toLowerCase()}`} placeholder="Search records…" value={search} onChange={(event) => setSearch(event.target.value)} />
        <span className="student-reports-count">{filtered.length} record(s)</span>
      </div>
      {loading ? <LoadingState message={`Loading ${title.toLowerCase()}…`} /> :
        error ? <ErrorState title={`Unable to load ${title.toLowerCase()}`} message={error} onRetry={() => setRefresh((value) => value + 1)} /> :
          filtered.length === 0 ? <EmptyState title="Nothing to display" message={search ? 'No records match your search.' : emptyMessage} /> :
            <div className="records-grid">{filtered.map((record, index) => {
              const status = record.status || record.state
              const summary = record.courseUnit?.name || record.courseUnit?.code ||
                record.student?.displayName || record.student?.name ||
                record.description || record.email || record.displayName || ''
              const secondary = record.student?.studentNumber || record.studentNumber ||
                record.assignedLecturer?.displayName || record.createdAt || ''
              return (
                <article className="record-card" key={record.id || record.reference || index}>
                  <div>
                    <h3>{recordTitle(record)}</h3>
                    {summary && <p>{summary}</p>}
                    {secondary && <small>{secondary}</small>}
                  </div>
                  <div className="record-actions">
                    {status && <StatusChip status={status} />}
                    {renderActions?.(record)}
                  </div>
                </article>
              )
            })}</div>}
    </section>
  )
}
