import { useCallback, useEffect, useState } from 'react'
import { BookOpenCheck, CalendarClock, ClipboardList, GraduationCap, RefreshCw } from 'lucide-react'
import {
  createLecturerAttendanceSession,
  endLecturerAttendanceSession,
  getLecturerAttendanceSessions,
  startLecturerAttendanceSession,
} from '../../api/lecturer'
import { extractRecords } from '../shared/recordUtils'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import StatusChip from '../../components/ui/StatusChip'
import '../../styles/LecturerAttendance.css'

const sessionTypes = [
  { value: 'CAT', label: 'CAT', description: 'Continuous assessment tests', icon: ClipboardList },
  { value: 'EXAM', label: 'Exam', description: 'Formal examination sessions', icon: GraduationCap },
  { value: 'CLASS', label: 'Class', description: 'Regular class attendance', icon: BookOpenCheck },
]

const initialForm = { courseUnitId: '', classroomId: '', assessmentId: '', startsAt: '', endsAt: '' }

export default function LecturerAttendance() {
  const [sessions, setSessions] = useState([])
  const [form, setForm] = useState(initialForm)
  const [activeType, setActiveType] = useState('CAT')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const load = useCallback(async () => {
    const result = await getLecturerAttendanceSessions({ page: 1, limit: 100 })
    return extractRecords(result, ['sessions'])
  }, [])

  useEffect(() => {
    let active = true
    load().then((items) => {
      if (!active) return
      setSessions(items)
      setError('')
    })
      .catch((requestError) => { if (active) setError(requestError.userMessage || 'Unable to load attendance sessions.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [load, refresh])

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    const payload = {
      sessionType: activeType,
      courseUnitId: form.courseUnitId.trim(),
      classroomId: form.classroomId.trim(),
      startsAt: new Date(form.startsAt).toISOString(),
      ...(form.endsAt ? { endsAt: new Date(form.endsAt).toISOString() } : {}),
      ...(activeType !== 'CLASS' && form.assessmentId.trim() ? { assessmentId: form.assessmentId.trim() } : {}),
    }
    try {
      await createLecturerAttendanceSession(payload)
      setForm(initialForm)
      setRefresh((value) => value + 1)
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to create the attendance session.')
    } finally {
      setSaving(false)
    }
  }

  const updateSession = async (session, action) => {
    setError('')
    try {
      if (action === 'start') await startLecturerAttendanceSession(session.id)
      else await endLecturerAttendanceSession(session.id)
      setRefresh((value) => value + 1)
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to update the attendance session.')
    }
  }

  const filteredSessions = sessions.filter((session) => String(session.sessionType).toUpperCase() === activeType)
  const sessionCount = (type) => sessions.filter((session) => String(session.sessionType).toUpperCase() === type).length
  const activeSession = sessionTypes.find(({ value }) => value === activeType)

  return (
    <section className="lecturer-attendance">
      <header className="page-heading lecturer-attendance-heading">
        <div><p className="eyebrow">LECTURER PORTAL</p><h2>Attendance management</h2><p>Manage attendance sessions by assessment type.</p></div>
        <button className="button button-secondary" type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} /> Refresh</button>
      </header>

      <section className="lecturer-attendance-workspace">
        <div className="lecturer-attendance-tabs" role="tablist" aria-label="Attendance session type">
          {sessionTypes.map(({ value, label, description, icon: Icon }) => (
            <button
              key={value}
              id={`lecturer-attendance-tab-${value.toLowerCase()}`}
              className={`lecturer-attendance-tab ${activeType === value ? 'active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeType === value}
              aria-controls="lecturer-attendance-panel"
              onClick={() => setActiveType(value)}
            >
              <span className="lecturer-attendance-tab-icon"><Icon size={18} /></span>
              <span className="lecturer-attendance-tab-copy"><strong>{label}</strong><small>{description}</small></span>
              <span className="lecturer-attendance-tab-count">{sessionCount(value)}</span>
            </button>
          ))}
        </div>

        <div id="lecturer-attendance-panel" className="lecturer-attendance-panel" role="tabpanel" aria-labelledby={`lecturer-attendance-tab-${activeType.toLowerCase()}`}>
          <div className="lecturer-attendance-section-heading">
            <div><span className="eyebrow">SESSION TYPE</span><h3>{activeSession?.label} attendance</h3><p>{activeSession?.description}. Create a session or manage your existing sessions.</p></div>
            <span className="lecturer-attendance-total">{sessionCount(activeType)} session{sessionCount(activeType) === 1 ? '' : 's'}</span>
          </div>

          {error && <div className="form-alert" role="alert">{error}</div>}

          <form className="panel lecturer-attendance-form" onSubmit={submit}>
            <div className="lecturer-attendance-form-title"><CalendarClock size={18} /><h3>Create {activeSession?.label.toLowerCase()} session</h3></div>
            <div className="form-grid">
              <div className="form-field"><label htmlFor="session-course">Course unit UUID</label><input id="session-course" value={form.courseUnitId} onChange={(event) => setForm({ ...form, courseUnitId: event.target.value })} required /></div>
              <div className="form-field"><label htmlFor="session-classroom">Classroom UUID</label><input id="session-classroom" value={form.classroomId} onChange={(event) => setForm({ ...form, classroomId: event.target.value })} required /></div>
              {activeType !== 'CLASS' && <div className="form-field"><label htmlFor="session-assessment">Assessment UUID</label><input id="session-assessment" value={form.assessmentId} onChange={(event) => setForm({ ...form, assessmentId: event.target.value })} required /></div>}
              <div className="form-field"><label htmlFor="session-start">Starts at</label><input id="session-start" type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} required /></div>
              <div className="form-field"><label htmlFor="session-end">Ends at (optional)</label><input id="session-end" type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></div>
            </div>
            <button className="button button-primary" disabled={saving}><CalendarClock size={16} />{saving ? 'Creating…' : `Create ${activeSession?.label.toLowerCase()} session`}</button>
          </form>

          <div className="lecturer-attendance-session-list">
            <div className="lecturer-attendance-list-heading"><div><h3>{activeSession?.label} sessions</h3><p>Start or end an attendance window when needed.</p></div></div>
            {loading ? <LoadingState message={`Loading ${activeSession?.label.toLowerCase()} sessions…`} /> : error && sessions.length === 0 ? <ErrorState title="Unable to load sessions" message={error} onRetry={() => setRefresh((value) => value + 1)} /> : filteredSessions.length === 0 ? <EmptyState title={`No ${activeSession?.label.toLowerCase()} sessions yet`} message={`Create a ${activeSession?.label.toLowerCase()} attendance session to get started.`} /> : filteredSessions.map((session) => (
              <article className="record-card lecturer-attendance-session" key={session.id}>
                <div className="lecturer-attendance-session-info"><span className="lecturer-attendance-session-icon"><CalendarClock size={18} /></span><div><h3>{session.courseUnit?.code || session.courseUnit?.name || `${activeSession?.label} session`}</h3><p>{session.startsAt ? new Date(session.startsAt).toLocaleString() : 'Start time unavailable'}</p><small>{session.classroom?.name || session.classroomName || session.id}</small></div></div>
                <div className="record-actions"><StatusChip status={session.status || 'scheduled'} />{String(session.status).toUpperCase() === 'SCHEDULED' && <button className="button button-secondary" type="button" onClick={() => updateSession(session, 'start')}>Start</button>}{String(session.status).toUpperCase() === 'ACTIVE' && <button className="button button-secondary" type="button" onClick={() => updateSession(session, 'end')}>End</button>}</div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </section>
  )
}
