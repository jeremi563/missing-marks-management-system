import { useEffect, useState } from 'react'
import { CalendarClock, CheckCircle, MapPin, RefreshCw, XCircle } from 'lucide-react'
import { getLecturerAttendanceRecords, getLecturerAttendanceSessions } from '../../api/lecturer'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import LoadingState from '../../components/ui/LoadingState'
import { extractRecords } from '../shared/recordUtils'
import './LecturerAttendanceLists.css'

const SESSION_TYPES = [
  { value: 'CLASS', label: 'Class attendance' },
  { value: 'CAT', label: 'CAT attendance' },
  { value: 'EXAM', label: 'Exam attendance' },
]

function getPagination(response, page) {
  const envelope = response?.data ?? response
  const payload = envelope?.data ?? envelope
  return envelope?.pagination ?? payload?.pagination ?? { page, totalPages: 1 }
}

function getPeriodLabels(periods) {
  if (!periods?.length) return 'Academic period unavailable'
  return periods.map((period) => [
    period.academicYear || 'Year not specified',
    period.semester ? `Semester ${period.semester}` : 'Semester not specified',
  ].join(' · ')).join(', ')
}

function getAttendanceDisplay(row) {
  if (String(row.status).toUpperCase() === 'LATE') return { label: 'Late', className: 'late' }
  return row.attended
    ? { label: 'Attended', className: 'attended' }
    : { label: 'Did not attend', className: 'absent' }
}

export default function LecturerAttendanceLists() {
  const [sessionType, setSessionType] = useState('CLASS')
  const [sessions, setSessions] = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [roster, setRoster] = useState([])
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 })
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [rosterLoading, setRosterLoading] = useState(false)
  const [rosterRefresh, setRosterRefresh] = useState(0)
  const [sessionsRefresh, setSessionsRefresh] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getLecturerAttendanceSessions({ page, limit: 20, sessionType })
      .then((response) => {
        if (!active) return
        const items = extractRecords(response, ['sessions'])
        setSessions(items)
        setPagination(getPagination(response, page))
        setRosterLoading(items.length > 0)
        setSelectedSessionId(items[0]?.id || '')
      })
      .catch((requestError) => {
        if (active) setError(requestError.userMessage || 'Unable to load attendance sessions.')
      })
      .finally(() => {
        if (active) setSessionsLoading(false)
      })

    return () => { active = false }
  }, [page, sessionType, sessionsRefresh])

  useEffect(() => {
    if (!selectedSessionId) return undefined

    let active = true
    getLecturerAttendanceRecords(selectedSessionId)
      .then((response) => {
        if (active) setRoster(extractRecords(response, ['records', 'roster']))
      })
      .catch((requestError) => {
        if (active) setError(requestError.userMessage || 'Unable to load the enrolled-student attendance list.')
      })
      .finally(() => {
        if (active) setRosterLoading(false)
      })

    return () => { active = false }
  }, [rosterRefresh, selectedSessionId])

  const selectedSession = sessions.find(({ id }) => id === selectedSessionId)
  const attendedCount = roster.filter(({ attended }) => attended).length
  const absentCount = roster.length - attendedCount
  const resetSessionList = () => {
    setSessionsLoading(true)
    setSessions([])
    setSelectedSessionId('')
    setRoster([])
    setRosterLoading(false)
    setError('')
  }

  return (
    <section className="lecturer-attendance-lists">
      <header className="page-heading">
        <div>
          <p className="eyebrow">LECTURER PORTAL</p>
          <h2>Attendance lists</h2>
          <p>Review enrolled students for each class, CAT, or examination session, including students with no check-in.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => {
          resetSessionList()
          setSessionsRefresh((value) => value + 1)
        }}>
          <RefreshCw size={16} /> Refresh lists
        </button>
      </header>

      <div className="attendance-list-tabs" role="tablist" aria-label="Attendance list category">
        {SESSION_TYPES.map(({ value, label }) => (
          <button
            key={value}
            id={`attendance-list-tab-${value.toLowerCase()}`}
            type="button"
            role="tab"
            aria-selected={sessionType === value}
            aria-controls="attendance-list-panel"
            className={sessionType === value ? 'active' : ''}
            onClick={() => {
              if (value === sessionType) return
              resetSessionList()
              setPage(1)
              setSessionType(value)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={() => {
        if (selectedSessionId) {
          setError('')
          setRosterLoading(true)
          setRosterRefresh((value) => value + 1)
        } else {
          resetSessionList()
          setSessionsRefresh((value) => value + 1)
        }
      }} />}

      <div id="attendance-list-panel" role="tabpanel" aria-labelledby={`attendance-list-tab-${sessionType.toLowerCase()}`}>
        <section className="panel attendance-list-sessions">
          <div className="attendance-list-section-heading">
            <div>
              <h3>{SESSION_TYPES.find(({ value }) => value === sessionType)?.label} sessions</h3>
              <p>Select a session to see its complete enrolled-student roster.</p>
            </div>
            <span>{pagination.total ?? sessions.length} total</span>
          </div>

          {sessionsLoading ? <LoadingState message="Loading sessions…" /> : sessions.length === 0 ? (
            <EmptyState title="No sessions found" message="Sessions of this type will appear here after they are created." />
          ) : (
            <>
              <div className="attendance-list-session-grid">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    className={`attendance-list-session ${selectedSessionId === session.id ? 'selected' : ''}`}
                    type="button"
                    aria-pressed={selectedSessionId === session.id}
                    onClick={() => {
                      setError('')
                      setRoster([])
                      setRosterLoading(true)
                      if (session.id === selectedSessionId) {
                        setRosterRefresh((value) => value + 1)
                      } else {
                        setSelectedSessionId(session.id)
                      }
                    }}
                  >
                    <CalendarClock size={17} />
                    <span>
                      <strong>{session.courseUnit?.code || session.courseUnit?.name || 'Course unit unavailable'}</strong>
                      <small>{session.assessment?.name || session.assessment?.code || sessionType}</small>
                      <small>{session.startsAt ? new Date(session.startsAt).toLocaleString() : 'Session date unavailable'}</small>
                    </span>
                  </button>
                ))}
              </div>
              <div className="attendance-list-pagination">
                <button className="button button-secondary" type="button" disabled={page <= 1} onClick={() => {
                  resetSessionList()
                  setPage((value) => value - 1)
                }}>Previous</button>
                <span>Page {pagination.page || page} of {pagination.totalPages || 1}</span>
                <button className="button button-secondary" type="button" disabled={page >= (pagination.totalPages || 1)} onClick={() => {
                  resetSessionList()
                  setPage((value) => value + 1)
                }}>Next</button>
              </div>
            </>
          )}
        </section>

        {selectedSession && (
          <section className="panel attendance-list-roster" aria-label={`${selectedSession.courseUnit?.code || 'Session'} roster`}>
            <div className="attendance-list-section-heading">
              <div>
                <p className="eyebrow">{selectedSession.assessment?.name || selectedSession.sessionType || sessionType}</p>
                <h3>{selectedSession.courseUnit?.code} · {selectedSession.courseUnit?.name}</h3>
                <p>{selectedSession.startsAt ? new Date(selectedSession.startsAt).toLocaleString() : 'Session date unavailable'} · {selectedSession.classroom?.name || 'Classroom unavailable'}</p>
              </div>
              <div className="attendance-list-summary">
                <span><CheckCircle size={15} /> Attended {attendedCount}</span>
                <span><XCircle size={15} /> Did not attend {absentCount}</span>
              </div>
            </div>

            {rosterLoading ? <LoadingState message="Loading enrolled students…" /> : roster.length === 0 ? (
              <EmptyState title="No enrolled students for this session" message="The session roster includes students enrolled in this course unit during its academic year." />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Registration number</th><th>Student</th><th>Academic year / semester</th><th>Attendance</th><th>Check-in time</th><th>Location</th></tr>
                  </thead>
                  <tbody>
                    {roster.map((row) => {
                      const attendance = getAttendanceDisplay(row)
                      return (
                        <tr key={row.student.id}>
                          <td>{row.student.studentNumber}</td>
                          <td>{row.student.user?.displayName || 'Name unavailable'}</td>
                          <td>{getPeriodLabels(row.academicPeriods)}</td>
                          <td><span className={`attendance-list-status ${attendance.className}`}>{attendance.label}</span></td>
                          <td>{row.recordedAt ? new Date(row.recordedAt).toLocaleString() : '—'}</td>
                          <td>{row.attended ? <span className="attendance-list-location"><MapPin size={14} />{row.locationVerified ? 'Verified' : 'Not verified'}</span> : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </section>
  )
}
