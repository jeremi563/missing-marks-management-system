import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Settings2 } from 'lucide-react'
import {
  getCodSpecialCases,
  getCodSpecialCaseSchedulingConfigs,
  saveCodSpecialCaseSchedulingConfig,
} from '../../api/cod'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import StatusChip from '../../components/ui/StatusChip'
import { extractRecords, fetchAllRecordPages } from '../shared/recordUtils'
import CodSpecialCaseDecisionPanel from './CodSpecialCaseDecisionPanel'
import './CodSpecialCases.css'

function formatDate(value) {
  if (!value) return 'Not set'
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? 'Not set' : date.toLocaleString()
}

export default function CodSpecialCases() {
  const [cases, setCases] = useState([])
  const [configurations, setConfigurations] = useState([])
  const [draftDays, setDraftDays] = useState({})
  const [selectedId, setSelectedId] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingDepartment, setSavingDepartment] = useState('')
  const [now] = useState(() => Date.now())
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setError('')
    try {
      const [caseResponse, configResponse] = await Promise.all([
        getCodSpecialCases({ page: 1, limit: 100 }),
        getCodSpecialCaseSchedulingConfigs(),
      ])
      const nextConfigurations = extractRecords(configResponse, ['departments', 'configurations'])
      setCases(await fetchAllRecordPages(
        (page) => getCodSpecialCases({ page, limit: 100 }),
        caseResponse,
        ['items', 'cases', 'specialCases'],
      ))
      setConfigurations(nextConfigurations)
      setDraftDays(Object.fromEntries(nextConfigurations.map((item) => [item.id, item.schedulingDays ?? ''])))
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to load departmental special cases.')
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => { if (active) return load() })
    return () => { active = false }
  }, [load])

  const stats = useMemo(() => {
    return {
      pendingLecturer: cases.filter(({ status }) => status === 'PENDING_LECTURER_REVIEW').length,
      pendingCod: cases.filter(({ status }) => status === 'PENDING_COD_REVIEW').length,
      pendingScheduling: cases.filter(({ status }) => status === 'PENDING_SCHEDULING').length,
      overdueScheduling: cases.filter(({ status, schedulingDeadlineAt }) => status === 'PENDING_SCHEDULING' && schedulingDeadlineAt && new Date(schedulingDeadlineAt).valueOf() < now).length,
      scheduled: cases.filter(({ status }) => status === 'SCHEDULED').length,
      completed: cases.filter(({ status }) => status === 'COMPLETED').length,
      nonAttendance: cases.filter(({ status }) => status === 'DID_NOT_ATTEND').length,
    }
  }, [cases, now])
  const visibleCases = useMemo(() => statusFilter ? cases.filter(({ status }) => status === statusFilter) : cases, [cases, statusFilter])
  const configByDepartment = useMemo(() => new Map(configurations.map((item) => [item.id, item])), [configurations])

  const saveConfiguration = async (departmentId) => {
    const schedulingDays = Number(draftDays[departmentId])
    if (!Number.isInteger(schedulingDays) || schedulingDays < 1 || schedulingDays > 90) {
      setError('Scheduling period must be a whole number from 1 to 90 days.')
      return
    }
    setSavingDepartment(departmentId)
    setError('')
    setNotice('')
    try {
      await saveCodSpecialCaseSchedulingConfig(departmentId, schedulingDays)
      setNotice('Department scheduling configuration saved and audited.')
      await load(false)
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to save the scheduling configuration.')
    } finally {
      setSavingDepartment('')
    }
  }

  if (loading) return <LoadingState message="Loading departmental special cases…" />
  if (error && !cases.length && !configurations.length) return <ErrorState title="Special cases unavailable" message={error} onRetry={load} />

  return (
    <section className="cod-special-cases">
      <header className="page-heading">
        <div><p className="eyebrow">DEPARTMENT WORKSPACE</p><h2>Special cases</h2><p>Make final departmental decisions, configure lecturer scheduling periods, and monitor assessment follow-through.</p></div>
      </header>
      {error && <div className="form-alert" role="alert">{error}</div>}
      {notice && <div className="form-alert success" role="status">{notice}</div>}

      <section className="panel cod-special-case-config">
        <div><p className="eyebrow"><Settings2 size={15} /> CONFIGURATION</p><h3>Scheduling period</h3><p>Set the number of days lecturers have to schedule an approved case. This is not an application submission deadline.</p></div>
        {!configurations.length ? <p className="special-case-note">No departments are currently authorized for this COD account.</p> : configurations.map((department) => (
          <form className="cod-special-case-config-row" key={department.id} onSubmit={(event) => { event.preventDefault(); saveConfiguration(department.id) }}>
            <div><h4>{department.name} <small>{department.code}</small></h4><p>{department.schedulingDays == null ? 'No scheduling period configured' : `${department.schedulingDays} days · Updated ${formatDate(department.updatedAt)}`}</p></div>
            <label htmlFor={`special-case-days-${department.id}`}>Days to schedule
              <input id={`special-case-days-${department.id}`} type="number" min="1" max="90" step="1" required value={draftDays[department.id] ?? ''} onChange={(event) => setDraftDays((draft) => ({ ...draft, [department.id]: event.target.value }))} />
            </label>
            <button type="submit" className="button button-primary" disabled={savingDepartment === department.id}>{savingDepartment === department.id ? 'Saving…' : 'Save period'}</button>
          </form>
        ))}
      </section>

      <section className="cod-special-case-monitor" aria-label="Special-case workflow monitoring">
        {[
          ['Pending lecturer review', stats.pendingLecturer],
          ['Pending COD decision', stats.pendingCod],
          ['Awaiting scheduling', stats.pendingScheduling],
          ['Overdue scheduling', stats.overdueScheduling],
          ['Scheduled', stats.scheduled],
          ['Completed', stats.completed],
          ['Non-attendance', stats.nonAttendance],
        ].map(([label, count]) => <article className="panel cod-special-case-metric" key={label}><span>{label}</span><strong>{count}</strong></article>)}
      </section>

      <section className="panel cod-special-case-list">
        <div className="special-case-inbox-heading">
          <h3>Department applications</h3>
          <label>Filter by status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              {['PENDING_LECTURER_REVIEW', 'PENDING_COD_REVIEW', 'PENDING_SCHEDULING', 'SCHEDULED', 'COMPLETED', 'DID_NOT_ATTEND', 'REJECTED', 'CANCELLED'].map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
            </select>
          </label>
        </div>
        {!visibleCases.length ? <div className="special-case-empty"><FileText size={28} /><p>No applications are available for this filter.</p></div> : (
          <div className="special-case-inbox-list">
            {visibleCases.map((item) => {
              const overdue = item.status === 'PENDING_SCHEDULING' && item.schedulingDeadlineAt && new Date(item.schedulingDeadlineAt).valueOf() < now
              return (
                <article className="special-case-inbox-item" key={item.id}>
                  <div><h4>{item.student?.user?.displayName || item.student?.studentNumber || 'Student application'}</h4><p>{item.student?.studentNumber} · {item.courseUnit?.code} · {item.assessment?.name}</p><small>{item.academicPeriod?.name} · {overdue ? `Scheduling overdue since ${formatDate(item.schedulingDeadlineAt)}` : `Submitted ${formatDate(item.submittedAt || item.createdAt)}`}</small></div>
                  <div className="record-actions"><StatusChip status={item.status} /><button type="button" className="button button-secondary" onClick={() => setSelectedId(item.id)}>Review</button></div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {selectedId && <CodSpecialCaseDecisionPanel
        id={selectedId}
        hasSchedulingConfig={Boolean(configByDepartment.get(cases.find(({ id }) => id === selectedId)?.courseUnit?.departmentId)?.schedulingDays)}
        onClose={() => setSelectedId('')}
        onDecision={() => load(false)}
      />}
    </section>
  )
}
