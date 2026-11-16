import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import Pager from '../../components/ui/Pager'
import {
  getAdminAcademicPeriods,
  getAdminCourseUnits,
  getAdminDepartments,
  getAdminReports,
} from '../../api/admin'
import { extractRecords } from '../shared/recordUtils'

const emptyDraft = { status: '', departmentId: '', courseUnitId: '', academicPeriodId: '', from: '', to: '' }

async function loadAllOptions(fetchPage, collectionKey) {
  const records = []
  let page = 1
  while (true) {
    const response = await fetchPage({ page, limit: 100 })
    records.push(...extractRecords(response, [collectionKey]))
    const totalPages = response?.pagination?.totalPages || 1
    if (page >= totalPages) break
    page += 1
  }
  return records
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

export default function AdminReports() {
  const [reports, setReports] = useState([])
  const [summary, setSummary] = useState({ total: 0, byStatus: [] })
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0, total: 0 })
  const [departments, setDepartments] = useState([])
  const [courseUnits, setCourseUnits] = useState([])
  const [academicPeriods, setAcademicPeriods] = useState([])
  const [filters, setFilters] = useState({})
  const [draft, setDraft] = useState(emptyDraft)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [error, setError] = useState('')
  const [optionsError, setOptionsError] = useState('')
  const [filterError, setFilterError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [optionsRefresh, setOptionsRefresh] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([
      loadAllOptions(getAdminDepartments, 'departments'),
      loadAllOptions(getAdminCourseUnits, 'courseUnits'),
      loadAllOptions(getAdminAcademicPeriods, 'academicPeriods'),
    ]).then(([loadedDepartments, loadedCourseUnits, loadedPeriods]) => {
      if (!active) return
      setDepartments(loadedDepartments)
      setCourseUnits(loadedCourseUnits)
      setAcademicPeriods(loadedPeriods)
      setOptionsError('')
    }).catch((requestError) => {
      if (active) setOptionsError(requestError.userMessage || 'Unable to load report filters.')
    }).finally(() => {
      if (active) setOptionsLoading(false)
    })
    return () => { active = false }
  }, [optionsRefresh])

  const load = useCallback(async () => {
    const response = await getAdminReports({ page, limit: 20, ...filters })
    return response
  }, [filters, page])

  useEffect(() => {
    let active = true
    load().then((response) => {
      if (!active) return
      setReports(extractRecords(response, ['reports']))
      setSummary(response?.data?.summary || { total: 0, byStatus: [] })
      setPagination(response?.pagination || { page, totalPages: 0, total: 0 })
      setError('')
    }).catch((requestError) => {
      if (active) setError(requestError.userMessage || 'Unable to load report summaries.')
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
    setFilters({
      ...(draft.status.trim() ? { status: draft.status.trim() } : {}),
      ...(draft.departmentId ? { departmentId: draft.departmentId } : {}),
      ...(draft.courseUnitId ? { courseUnitId: draft.courseUnitId } : {}),
      ...(draft.academicPeriodId ? { academicPeriodId: draft.academicPeriodId } : {}),
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

  const refreshReports = () => {
    setLoading(true)
    setError('')
    setRefresh((value) => value + 1)
  }

  const changePage = (nextPage) => {
    setLoading(true)
    setPage(nextPage)
  }

  const retryOptions = () => {
    setOptionsLoading(true)
    setOptionsError('')
    setOptionsRefresh((value) => value + 1)
  }

  return (
    <section>
      <header className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h2>Report summaries</h2>
          <p>Review system-wide missing-mark reports using the available academic and date filters.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={refreshReports}>
          <RefreshCw size={16} /> Refresh
        </button>
      </header>

      <form className="panel form-stack" onSubmit={applyFilters}>
        <h3>Filter reports</h3>
        {filterError && <p className="form-alert" role="alert">{filterError}</p>}
        {optionsError && (
          <ErrorState
            title="Unable to load filter options"
            message={optionsError}
            onRetry={retryOptions}
          />
        )}
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="admin-report-status">Status</label>
            <input id="admin-report-status" value={draft.status} maxLength={80} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))} placeholder="Any status" />
          </div>
          <div className="form-field">
            <label htmlFor="admin-report-department">Department</label>
            <select id="admin-report-department" value={draft.departmentId} disabled={optionsLoading || Boolean(optionsError)} onChange={(event) => setDraft((current) => ({ ...current, departmentId: event.target.value, courseUnitId: '' }))}>
              <option value="">All departments</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.code || department.name} — {department.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="admin-report-course-unit">Course unit</label>
            <select id="admin-report-course-unit" value={draft.courseUnitId} disabled={optionsLoading || Boolean(optionsError)} onChange={(event) => setDraft((current) => ({ ...current, courseUnitId: event.target.value }))}>
              <option value="">All course units</option>
              {courseUnits.filter((unit) => !draft.departmentId || unit.departmentId === draft.departmentId).map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.code} — {unit.name}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="admin-report-period">Academic period</label>
            <select id="admin-report-period" value={draft.academicPeriodId} disabled={optionsLoading || Boolean(optionsError)} onChange={(event) => setDraft((current) => ({ ...current, academicPeriodId: event.target.value }))}>
              <option value="">All academic periods</option>
              {academicPeriods.map((period) => <option key={period.id} value={period.id}>{period.name}{period.code ? ` (${period.code})` : ''}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="admin-report-from">Created from</label>
            <input id="admin-report-from" type="datetime-local" value={draft.from} onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))} />
          </div>
          <div className="form-field">
            <label htmlFor="admin-report-to">Created through</label>
            <input id="admin-report-to" type="datetime-local" value={draft.to} onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))} />
          </div>
        </div>
        <div className="record-actions">
          <button className="button button-primary" type="submit" disabled={optionsLoading}>Apply filters</button>
          <button className="button button-secondary" type="button" onClick={clearFilters}>Clear filters</button>
        </div>
      </form>

      {summary.byStatus.length > 0 && (
        <div className="records-grid" aria-label="Report totals by status">
          {summary.byStatus.map(({ status, count }) => (
            <article className="record-card" key={status}><h3>{status}</h3><p>{count} report(s)</p></article>
          ))}
        </div>
      )}
      {!loading && !error && <p className="field-hint" role="status">{pagination.total ?? summary.total} report(s) match the applied filters.</p>}
      {loading ? <LoadingState message="Loading report summaries…" /> :
        error ? <ErrorState title="Unable to load report summaries" message={error} onRetry={() => setRefresh((value) => value + 1)} /> :
          reports.length === 0 ? <EmptyState title="No reports found" message="No missing-mark reports match the applied filters." /> : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Reference</th><th>Status</th><th>Department</th><th>Course unit</th><th>Academic period</th><th>Assigned lecturer</th><th>Submitted</th><th>Created</th></tr>
                  </thead>
                  <tbody>
                    {reports.map((report) => (
                      <tr key={report.id}>
                        <td>{report.reference}</td>
                        <td>{report.status}</td>
                        <td>{report.courseUnit.department?.code || report.courseUnit.department?.name || '—'}</td>
                        <td>{report.courseUnit.code} — {report.courseUnit.name}</td>
                        <td>{report.academicPeriod.name}</td>
                        <td>{report.assignedLecturer?.user?.displayName || report.assignedLecturer?.staffNumber || 'Unassigned'}</td>
                        <td>{formatDate(report.submittedAt)}</td>
                        <td>{formatDate(report.createdAt)}</td>
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
