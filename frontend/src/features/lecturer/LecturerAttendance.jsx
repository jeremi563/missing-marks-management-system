import { useCallback, useEffect, useState } from 'react'
import { BookOpenCheck, CalendarClock, ClipboardList, GraduationCap, RefreshCw } from 'lucide-react'
import {
  createLecturerAttendanceSession,
  endLecturerAttendanceSession,
  getLecturerCourseUnitAssessments,
  getLecturerCourseUnits,
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

const initialForm = {
  courseUnitId: '',
  classroomId: '',
  assessmentId: '',
  sessionDate: '',
  startsAt: '',
  endDate: '',
  endsAt: '',
}

function getCatNumber(assessment) {
  const label = `${assessment.code || ''} ${assessment.name || ''}`
  const match = label.match(/\b(?:CAT|CATS|CONTINUOUS\s+ASSESSMENT)\s*[-_#:]?\s*(1|2)\b/i)
  return match?.[1] || null
}

export default function LecturerAttendance() {
  const [sessions, setSessions] = useState([])
  const [courseUnits, setCourseUnits] = useState([])
  const [assessments, setAssessments] = useState([])
  const [form, setForm] = useState(initialForm)
  const [activeType, setActiveType] = useState('CAT')
  const [error, setError] = useState('')
  const [courseUnitsError, setCourseUnitsError] = useState('')
  const [assessmentsError, setAssessmentsError] = useState('')
  const [loading, setLoading] = useState(true)
  const [courseUnitsLoading, setCourseUnitsLoading] = useState(true)
  const [assessmentsLoading, setAssessmentsLoading] = useState(false)
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

  useEffect(() => {
    let active = true
    getLecturerCourseUnits()
      .then((response) => {
        if (!active) return
        const assignments = extractRecords(response)
        const assignedUnits = assignments.map(({ courseUnit }) => courseUnit).filter(Boolean)
        setCourseUnits(assignedUnits)
        setCourseUnitsError('')
      })
      .catch((requestError) => {
        if (active) setCourseUnitsError(requestError.userMessage || 'Unable to load your assigned course units.')
      })
      .finally(() => {
        if (active) setCourseUnitsLoading(false)
      })

    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!form.courseUnitId || activeType === 'CLASS') return undefined

    let active = true
    getLecturerCourseUnitAssessments(form.courseUnitId, activeType)
      .then((response) => {
        if (!active) return
        setAssessments(extractRecords(response))
        setAssessmentsError('')
      })
      .catch((requestError) => {
        if (active) setAssessmentsError(requestError.userMessage || 'Unable to load assessments for this course unit.')
      })
      .finally(() => {
        if (active) setAssessmentsLoading(false)
      })

    return () => { active = false }
  }, [activeType, form.courseUnitId])

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (Boolean(form.endDate) !== Boolean(form.endsAt)) {
      setError('Choose both an end date and end time, or leave both blank.')
      return
    }
    if (form.endDate && form.endsAt && new Date(`${form.endDate}T${form.endsAt}`) <= new Date(`${form.sessionDate}T${form.startsAt}`)) {
      setError('End date and time must be after the start date and time.')
      return
    }
    if (activeType === 'EXAM' && assessments.length !== 1) {
      setError('An exam session requires exactly one exam assessment for the selected course unit.')
      return
    }
    if (activeType === 'CAT' && !form.assessmentId) {
      setError('Select CAT 1 or CAT 2 before creating the session.')
      return
    }
    setSaving(true)
    const payload = {
      sessionType: activeType,
      courseUnitId: form.courseUnitId.trim(),
      classroomId: form.classroomId.trim(),
      startsAt: new Date(`${form.sessionDate}T${form.startsAt}`).toISOString(),
      ...(form.endsAt && form.endDate ? { endsAt: new Date(`${form.endDate}T${form.endsAt}`).toISOString() } : {}),
      ...(activeType === 'CAT' ? { assessmentId: form.assessmentId } : {}),
      ...(activeType === 'EXAM' ? { assessmentId: assessments[0].id } : {}),
    }
    try {
      await createLecturerAttendanceSession(payload)
      setForm(initialForm)
      setAssessments([])
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
  const selectedCourseUnit = courseUnits.find(({ id }) => id === form.courseUnitId)
  const catAssessments = ['1', '2'].map((catNumber) => ({
    catNumber,
    assessment: assessments.find((assessment) => getCatNumber(assessment) === catNumber),
  }))



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
              onClick={() => {
                setActiveType(value)
                setForm(initialForm)
                setAssessments([])
                setAssessmentsError('')
                setAssessmentsLoading(value !== 'CLASS' && Boolean(form.courseUnitId))
              }}
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
            <div className="lecturer-attendance-form-grid">
              <div className="form-field">
                <label htmlFor="session-course">Course unit</label>
                <select
                  id="session-course"
                  value={form.courseUnitId}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, courseUnitId: event.target.value, assessmentId: '' }))
                    setAssessments([])
                    setAssessmentsError('')
                    setAssessmentsLoading(activeType !== 'CLASS' && Boolean(event.target.value))
                  }}
                  required
                  disabled={courseUnitsLoading || courseUnits.length === 0}
                >
                  <option value="">{courseUnitsLoading ? 'Loading your course units…' : 'Select a course unit'}</option>
                  {courseUnits.map((courseUnit) => (
                    <option key={courseUnit.id} value={courseUnit.id}>{courseUnit.code} — {courseUnit.name}</option>
                  ))}
                </select>
                {courseUnitsError && <small className="lecturer-attendance-field-error">{courseUnitsError}</small>}
              </div>
              <div className="form-field">
                <label htmlFor="session-course-code">Course unit code</label>
                <input id="session-course-code" value={selectedCourseUnit?.code || ''} placeholder="Auto-filled when you select a course unit" readOnly />
              </div>
              <div className="form-field">
                <label htmlFor="session-classroom">Classroom UUID</label>
                <input id="session-classroom" value={form.classroomId} onChange={(event) => setForm({ ...form, classroomId: event.target.value })} required />
              </div>
              {activeType === 'CAT' && (
                <div className="form-field">
                  <label htmlFor="session-assessment">CAT number</label>
                  <select
                    id="session-assessment"
                    value={form.assessmentId}
                    onChange={(event) => setForm((current) => ({ ...current, assessmentId: event.target.value }))}
                    required
                    disabled={!form.courseUnitId || assessmentsLoading}
                  >
                    <option value="">
                      {!form.courseUnitId ? 'Select a course unit first' : assessmentsLoading ? 'Loading CATs…' : 'Select CAT 1 or CAT 2'}
                    </option>
                    {catAssessments.map(({ catNumber, assessment }) => (
                      <option key={catNumber} value={assessment?.id || ''} disabled={!assessment}>
                        CAT {catNumber}{assessment ? (assessment.name ? ` — ${assessment.name}` : '') : ' — not configured'}
                      </option>
                    ))}
                  </select>
                  <small className="lecturer-attendance-field-hint">
                    {assessmentsError || (!assessmentsLoading && form.courseUnitId && !catAssessments.some(({ assessment }) => assessment)
                      ? 'No CAT 1 or CAT 2 assessment is configured for this course unit.'
                      : 'Choose an available CAT; its assessment is selected automatically.')}
                  </small>
                </div>
              )}
              {activeType === 'EXAM' && (
                <div className="form-field lecturer-attendance-assessment-status" role="status">
                  <span className="lecturer-attendance-field-label">Exam assessment</span>
                  <strong>{assessmentsLoading ? 'Finding exam…' : assessments.length === 1 ? `${selectedCourseUnit?.code} — ${assessments[0].name}` : 'Exam assessment unavailable'}</strong>
                  <small className="lecturer-attendance-field-hint">
                    {assessmentsError || (assessments.length > 1
                      ? 'More than one exam assessment is configured; ask your administrator to review the course unit.'
                      : !assessmentsLoading && form.courseUnitId && assessments.length === 0
                        ? 'No exam assessment is configured for this course unit.'
                        : 'The course unit’s exam assessment is selected automatically.')}
                  </small>
                </div>
              )}
              <div className="lecturer-attendance-schedule">
                <div className="lecturer-attendance-schedule-heading">
                  <CalendarClock size={17} />
                  <div><strong>Schedule</strong><small>Choose the session date and attendance window.</small></div>
                </div>
                <div className="lecturer-attendance-schedule-grid">
                  <div className="form-field">
                    <label htmlFor="session-date">Session date</label>
                    <input id="session-date" type="date" value={form.sessionDate} onChange={(event) => setForm({ ...form, sessionDate: event.target.value })} required />
                  </div>
                  <div className="form-field">
                    <label htmlFor="session-start">Start time</label>
                    <input id="session-start" type="time" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} required />
                  </div>
                  <div className="form-field">
                    <label htmlFor="session-end-date">End date <span className="lecturer-attendance-optional">(optional)</span></label>
                    <input id="session-end-date" type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
                  </div>
                  <div className="form-field">
                    <label htmlFor="session-end">End time <span className="lecturer-attendance-optional">(optional)</span></label>
                    <input id="session-end" type="time" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} />
                  </div>
                </div>
              </div>
            </div>
            <button className="button button-primary" disabled={saving || courseUnitsLoading || !courseUnits.length || (activeType === 'CAT' && (assessmentsLoading || !catAssessments.some(({ assessment }) => assessment))) || (activeType === 'EXAM' && (assessmentsLoading || assessments.length !== 1))}>
              <CalendarClock size={16} />{saving ? 'Creating…' : `Create ${activeSession?.label.toLowerCase()} session`}
            </button>
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
