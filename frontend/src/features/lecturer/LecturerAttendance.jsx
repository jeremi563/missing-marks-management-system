import { useCallback, useEffect, useState } from 'react'
import { BookOpenCheck, CalendarClock, ClipboardList, Copy, GraduationCap, QrCode, RefreshCw, Share2 } from 'lucide-react'
import {
  createLecturerAttendanceSession,
  endLecturerAttendanceSession,
  extendLecturerAttendanceSession,
  generateLecturerAttendanceLink,
  getLecturerClassrooms,
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

function AttendanceLinkCard({ url, onError, onCopy, onShare }) {
  const [qrImage, setQrImage] = useState('')

  useEffect(() => {
    let active = true
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toString(url, { type: 'svg', width: 240, margin: 2 }))
      .then((svg) => {
        if (active) setQrImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
      })
      .catch(() => {
        if (active) onError('Unable to render the QR code. You can still copy or share the link.')
      })
    return () => { active = false }
  }, [onError, url])

  return (
    <div className="lecturer-attendance-link">
      <div className="lecturer-attendance-qr">
        {qrImage ? <img src={qrImage} alt="QR code for student attendance check-in" /> : <QrCode size={34} aria-hidden="true" />}
      </div>
      <div className="lecturer-attendance-link-details">
        <input aria-label="Attendance link" value={url} readOnly onFocus={(event) => event.target.select()} />
        <div className="lecturer-attendance-link-actions">
          <button className="button button-secondary" type="button" onClick={onCopy}><Copy size={15} /> Copy link</button>
          <button className="button button-secondary" type="button" onClick={onShare}><Share2 size={15} /> Share link</button>
        </div>
      </div>
    </div>
  )
}

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
  endsAt: '',
}

function toLocalDateTimeInput(value) {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function getCatNumber(assessment) {
  const label = `${assessment.code || ''} ${assessment.name || ''}`
  const match = label.match(/\b(?:CAT|CATS|CONTINUOUS\s+ASSESSMENT)\s*[-_#:]?\s*(1|2)\b/i)
  return match?.[1] || null
}

export default function LecturerAttendance() {
  const [sessions, setSessions] = useState([])
  const [courseUnits, setCourseUnits] = useState([])
  const [classrooms, setClassrooms] = useState([])
  const [assessments, setAssessments] = useState([])
  const [form, setForm] = useState(initialForm)
  const [activeType, setActiveType] = useState('CAT')
  const [error, setError] = useState('')
  const [courseUnitsError, setCourseUnitsError] = useState('')
  const [classroomsError, setClassroomsError] = useState('')
  const [assessmentsError, setAssessmentsError] = useState('')
  const [loading, setLoading] = useState(true)
  const [courseUnitsLoading, setCourseUnitsLoading] = useState(true)
  const [classroomsLoading, setClassroomsLoading] = useState(true)
  const [assessmentsLoading, setAssessmentsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [linkingSessionId, setLinkingSessionId] = useState('')
  const [extendingSessionId, setExtendingSessionId] = useState('')
  const [editingEndTimeSessionId, setEditingEndTimeSessionId] = useState('')
  const [extensionValues, setExtensionValues] = useState({})
  const [attendanceTokens, setAttendanceTokens] = useState({})
  const [linkNotice, setLinkNotice] = useState('')
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
    if (!sessions.some((session) => ['SCHEDULED', 'ACTIVE'].includes(String(session.status).toUpperCase()))) {
      return undefined
    }

    const timer = window.setInterval(() => {
      load()
        .then((items) => {
          setSessions(items)
          setError('')
        })
        .catch((requestError) => setError(requestError.userMessage || 'Unable to refresh attendance sessions.'))
    }, 15_000)
    return () => window.clearInterval(timer)
  }, [load, sessions])

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
    let active = true
    getLecturerClassrooms()
      .then((response) => {
        if (!active) return
        setClassrooms(extractRecords(response, ['classrooms']))
        setClassroomsError('')
      })
      .catch((requestError) => {
        if (active) setClassroomsError(requestError.userMessage || 'Unable to load active classrooms.')
      })
      .finally(() => {
        if (active) setClassroomsLoading(false)
      })
    return () => { active = false }
  }, [refresh])

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
    if (!form.endsAt) {
      setError('Choose an end time so the session can close automatically.')
      return
    }
    if (form.endsAt && new Date(`${form.sessionDate}T${form.endsAt}`) <= new Date(`${form.sessionDate}T${form.startsAt}`)) {
      setError('End time must be after the start time.')
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
      endsAt: new Date(`${form.sessionDate}T${form.endsAt}`).toISOString(),
      ...(activeType === 'CAT' ? { assessmentId: form.assessmentId } : {}),
      ...(activeType === 'EXAM' ? { assessmentId: assessments[0].id } : {}),
    }
    try {
      const response = await createLecturerAttendanceSession(payload)
      const created = response?.data ?? response
      if (created.session?.id && created.qrToken) {
        setAttendanceTokens((current) => ({ ...current, [created.session.id]: created.qrToken }))
      }
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
    setLinkNotice('')
    try {
      if (action === 'start') {
        await startLecturerAttendanceSession(session.id)
        const response = await generateLecturerAttendanceLink(session.id)
        const result = response?.data ?? response
        setAttendanceTokens((current) => ({ ...current, [session.id]: result.qrToken }))
      } else {
        await endLecturerAttendanceSession(session.id)
        setAttendanceTokens((current) => {
          const next = { ...current }
          delete next[session.id]
          return next
        })
      }
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to update the attendance session.')
    } finally {
      setRefresh((value) => value + 1)
    }
  }

  const generateLink = async (session) => {
    setError('')
    setLinkNotice('')
    setLinkingSessionId(session.id)
    try {
      const response = await generateLecturerAttendanceLink(session.id)
      const result = response?.data ?? response
      setAttendanceTokens((current) => ({ ...current, [session.id]: result.qrToken }))
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to generate an attendance link.')
    } finally {
      setLinkingSessionId('')
    }
  }

  const extendSession = async (event, session) => {
    event.preventDefault()
    setError('')
    setLinkNotice('')
    const newEndTime = extensionValues[session.id] ?? toLocalDateTimeInput(session.endsAt)
    if (!newEndTime) {
      setError('Choose a new end time for this attendance session.')
      return
    }

    setExtendingSessionId(session.id)
    try {
      await extendLecturerAttendanceSession(session.id, new Date(newEndTime).toISOString())
      setExtensionValues((current) => {
        const next = { ...current }
        delete next[session.id]
        return next
      })
      setEditingEndTimeSessionId('')
      setLinkNotice('Session end time extended.')
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to extend the attendance session.')
    } finally {
      setExtendingSessionId('')
      setRefresh((value) => value + 1)
    }
  }

  const getAttendanceUrl = (token) => {
    const url = new URL('/student/attendance/check-in', window.location.origin)
    url.searchParams.set('token', token)
    return url.toString()
  }

  const copyAttendanceLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url)
      setError('')
      setLinkNotice('Attendance link copied to clipboard.')
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to copy the attendance link. Select and copy it from the field instead.')
    }
  }

  const shareAttendanceLink = async (url) => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Attendance check-in', text: 'Open this link to check in to attendance.', url })
        setLinkNotice('Attendance link shared.')
      } else {
        await navigator.clipboard.writeText(url)
        setLinkNotice('Attendance link copied to clipboard.')
      }
      setError('')
    } catch (requestError) {
      if (requestError.name !== 'AbortError') {
        setError(requestError.userMessage || 'Unable to share the attendance link. Copy it and send it to students.')
      } else {
        setLinkNotice('')
      }
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
          {linkNotice && <p className="lecturer-attendance-action-notice" role="status">{linkNotice}</p>}

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
                <label htmlFor="session-classroom">Classroom</label>
                <select id="session-classroom" value={form.classroomId} onChange={(event) => setForm({ ...form, classroomId: event.target.value })} required disabled={classroomsLoading || classrooms.length === 0}>
                  <option value="">{classroomsLoading ? 'Loading classrooms…' : classrooms.length ? 'Select a classroom' : 'No active classrooms available'}</option>
                  {classrooms.map((classroom) => <option key={classroom.id} value={classroom.id}>{classroom.name} · GPS boundary {classroom.boundaryMeters} m</option>)}
                </select>
                <small className={classroomsError ? 'lecturer-attendance-field-error' : 'lecturer-attendance-field-hint'}>
                  {classroomsError || (!classroomsLoading && !classrooms.length ? 'Ask an administrator to configure a classroom and its GPS boundary.' : 'Classrooms and GPS boundaries are configured by an administrator.')}
                </small>
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
                  <div><strong>Schedule</strong><small>Choose one session date and its attendance time window.</small></div>
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
                    <label htmlFor="session-end">End time</label>
                      <input id="session-end" type="time" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} required />
                  </div>
                </div>
              </div>
            </div>
            <button className="button button-primary" disabled={saving || courseUnitsLoading || !courseUnits.length || classroomsLoading || !classrooms.length || (activeType === 'CAT' && (assessmentsLoading || !catAssessments.some(({ assessment }) => assessment))) || (activeType === 'EXAM' && (assessmentsLoading || assessments.length !== 1))}>
              <CalendarClock size={16} />{saving ? 'Creating…' : `Create ${activeSession?.label.toLowerCase()} session`}
            </button>
          </form>

          <div className="lecturer-attendance-session-list">
            <div className="lecturer-attendance-list-heading"><div><h3>{activeSession?.label} sessions</h3><p>Start or end an attendance window when needed.</p></div></div>
            {loading ? <LoadingState message={`Loading ${activeSession?.label.toLowerCase()} sessions…`} /> : error && sessions.length === 0 ? <ErrorState title="Unable to load sessions" message={error} onRetry={() => setRefresh((value) => value + 1)} /> : filteredSessions.length === 0 ? <EmptyState title={`No ${activeSession?.label.toLowerCase()} sessions yet`} message={`Create a ${activeSession?.label.toLowerCase()} attendance session to get started.`} /> : filteredSessions.map((session) => (
              <article className="record-card lecturer-attendance-session" key={session.id}>
                <div className="lecturer-attendance-session-info"><span className="lecturer-attendance-session-icon"><CalendarClock size={18} /></span><div><h3>{session.courseUnit?.code || session.courseUnit?.name || `${activeSession?.label} session`}</h3><p>{session.startsAt ? new Date(session.startsAt).toLocaleString() : 'Start time unavailable'}</p><small>{session.classroom?.name || session.classroomName || session.id}</small>{session.endsAt && <small>Ends {new Date(session.endsAt).toLocaleString()}</small>}</div></div>
                <div className="record-actions"><StatusChip status={session.status || 'scheduled'} />{String(session.status).toUpperCase() === 'SCHEDULED' && <button className="button button-secondary" type="button" onClick={() => updateSession(session, 'start')}>Start</button>}{String(session.status).toUpperCase() === 'ACTIVE' && <button className="button button-secondary" type="button" onClick={() => updateSession(session, 'end')}>End now</button>}</div>
                {String(session.status).toUpperCase() === 'ACTIVE' && (
                  <>
                    <div className="lecturer-attendance-extend">
                      <button
                        className="lecturer-attendance-extend-toggle"
                        type="button"
                        aria-expanded={editingEndTimeSessionId === session.id}
                        aria-controls={`session-end-extension-panel-${session.id}`}
                        onClick={() => setEditingEndTimeSessionId((current) => current === session.id ? '' : session.id)}
                      >
                        <CalendarClock size={15} /> Adjust end time
                      </button>
                      {editingEndTimeSessionId === session.id && (
                      <form id={`session-end-extension-panel-${session.id}`} className="lecturer-attendance-extend-form" onSubmit={(event) => extendSession(event, session)}>
                        <div className="form-field">
                          <label htmlFor={`session-end-extension-${session.id}`}>New end time</label>
                          <input
                            id={`session-end-extension-${session.id}`}
                            type="datetime-local"
                            value={extensionValues[session.id] ?? toLocalDateTimeInput(session.endsAt)}
                            onChange={(event) => setExtensionValues((current) => ({ ...current, [session.id]: event.target.value }))}
                            required
                          />
                        </div>
                        <button className="button button-secondary" type="submit" disabled={extendingSessionId === session.id}>
                          {extendingSessionId === session.id ? 'Extending…' : 'Save new end time'}
                        </button>
                      </form>
                      )}
                    </div>
                    {attendanceTokens[session.id]
                    ? <AttendanceLinkCard
                      key={attendanceTokens[session.id]}
                      url={getAttendanceUrl(attendanceTokens[session.id])}
                      onError={setError}
                      onCopy={() => copyAttendanceLink(getAttendanceUrl(attendanceTokens[session.id]))}
                      onShare={() => shareAttendanceLink(getAttendanceUrl(attendanceTokens[session.id]))}
                    />
                    : <button className="button button-secondary lecturer-attendance-generate-link" type="button" disabled={linkingSessionId === session.id} onClick={() => generateLink(session)}>
                      <QrCode size={16} />{linkingSessionId === session.id ? 'Generating link…' : 'Generate attendance link'}
                    </button>}
                  </>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>
    </section>
  )
}
