

import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  ClipboardList,
  LoaderCircle,
  AlertCircle,
  Search,
} from 'lucide-react'
import { getStudentAttendance, getStudentCatSubmissions, getStudentExamAttendance } from '../../api/student'

function StudentAttendance() {
  const [records, setRecords] = useState([])
  const [catSubmissions, setCatSubmissions] = useState([])
  const [examAttendance, setExamAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sessionTypeFilter, setSessionTypeFilter] = useState('CLASS')

  const sessionTypes = [
    { value: 'CAT', label: 'CAT Attendance' },
    { value: 'EXAM', label: 'Exam Attendance' },
    { value: 'CLASS', label: 'Class Attendance' },
  ]

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        setLoading(true)
        setError('')

        const [response, catResponse, examResponse] = await Promise.all([
          getStudentAttendance({ page: 1, limit: 100 }),
          getStudentCatSubmissions({ page: 1, limit: 100 }),
          getStudentExamAttendance({ page: 1, limit: 100 }),
        ])
        const data = response?.data ?? response

        setRecords(Array.isArray(data) ? data : data?.records ?? [])
        const catData = catResponse?.data ?? catResponse
        setCatSubmissions(Array.isArray(catData) ? catData : catData?.items ?? [])
        const examData = examResponse?.data ?? examResponse
        setExamAttendance(Array.isArray(examData) ? examData : examData?.items ?? [])
      } catch (err) {
        setError(
          err.response?.data?.message ||
          'Unable to retrieve attendance history.'
        )
      } finally {
        setLoading(false)
      }
    }

    fetchAttendance()
  }, [])

  const getStatus = (status) => {
    const normalized = status?.toUpperCase()

    if (normalized === 'PRESENT' || normalized === 'VERIFIED') {
      return 'PRESENT'
    }

    if (normalized === 'ABSENT') {
      return 'ABSENT'
    }

    if (normalized === 'LATE') {
      return 'LATE'
    }

    return normalized || 'UNKNOWN'
  }

  const formatDate = (date) => {
    if (!date) return 'Not available'

    return new Date(date).toLocaleDateString()
  }

  const formatTime = (date) => {
    if (!date) return 'Not available'

    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const sessionType =
        record.attendanceRecord?.session?.sessionType ||
        record.sessionType ||
        'CLASS'
      const courseName =
        record.courseUnitName ||
        record.courseUnit?.name ||
        record.courseUnitCode ||
        record.courseUnit?.code ||
        ''

      const matchesSearch = courseName
        .toLowerCase()
        .includes(search.toLowerCase())

      const matchesStatus =
        statusFilter === 'ALL' ||
        getStatus(record.status) === statusFilter

      return (
        sessionType.toUpperCase() === sessionTypeFilter &&
        matchesSearch &&
        matchesStatus
      )
    })
  }, [records, search, sessionTypeFilter, statusFilter])

  const getSessionTypeCount = (sessionType) =>
    records.filter((record) => {
      const type =
        record.attendanceRecord?.session?.sessionType ||
        record.sessionType ||
        'CLASS'
      return type.toUpperCase() === sessionType
    }).length

  const statistics = useMemo(() => {
    const present = records.filter(
      (record) => getStatus(record.status) === 'PRESENT'
    ).length

    const absent = records.filter(
      (record) => getStatus(record.status) === 'ABSENT'
    ).length

    const late = records.filter(
      (record) => getStatus(record.status) === 'LATE'
    ).length

    return {
      total: records.length,
      present,
      absent,
      late,
    }
  }, [records])

  const getStatusIcon = (status) => {
    switch (status) {
      case 'PRESENT':
        return <CheckCircle size={16} />
      case 'ABSENT':
        return <XCircle size={16} />
      case 'LATE':
        return <Clock size={16} />
      default:
        return <AlertCircle size={16} />
    }
  }

  if (loading) {
    return (
      <div className="attendance-loading">
        <LoaderCircle size={30} className="attendance-spinner" />
        <p>Loading attendance history...</p>
      </div>
    )
  }

  return (
    <div className="student-attendance">

      <div className="attendance-header">
        <div>
          <h1>Attendance History</h1>
          <p>View and track your class and assessment attendance.</p>
        </div>
      </div>

      {error && (
        <div className="attendance-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="attendance-stats">

        <div className="attendance-stat-card">
          <div className="stat-icon total">
            <ClipboardList size={21} />
          </div>
          <div>
            <span>Total Sessions</span>
            <strong>{statistics.total}</strong>
          </div>
        </div>

        <div className="attendance-stat-card">
          <div className="stat-icon present">
            <CheckCircle size={21} />
          </div>
          <div>
            <span>Present</span>
            <strong>{statistics.present}</strong>
          </div>
        </div>

        <div className="attendance-stat-card">
          <div className="stat-icon absent">
            <XCircle size={21} />
          </div>
          <div>
            <span>Absent</span>
            <strong>{statistics.absent}</strong>
          </div>
        </div>

        <div className="attendance-stat-card">
          <div className="stat-icon late">
            <Clock size={21} />
          </div>
          <div>
            <span>Late</span>
            <strong>{statistics.late}</strong>
          </div>
        </div>

      </div>

      <section className="attendance-records">

        <div className="attendance-records-header">
          <div>
            <h2>Attendance Records</h2>
            <p>Review your recorded attendance sessions.</p>
          </div>
        </div>

        <div className="attendance-type-tabs" aria-label="Attendance type">
          {sessionTypes.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={sessionTypeFilter === value ? 'active' : ''}
              aria-pressed={sessionTypeFilter === value}
              onClick={() => setSessionTypeFilter(value)}
            >
              <span>{label}</span>
              <span className="attendance-type-count">
                {getSessionTypeCount(value)}
              </span>
            </button>
          ))}
        </div>

        <div className="attendance-filters">

          <div className="attendance-search">
            <Search size={18} />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search course unit"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="PRESENT">Present</option>
            <option value="ABSENT">Absent</option>
            <option value="LATE">Late</option>
          </select>

        </div>

        {filteredRecords.length === 0 ? (
          <div className="attendance-empty">
            <CalendarDays size={38} />
            <h3>No {sessionTypes.find(({ value }) => value === sessionTypeFilter)?.label} Records</h3>
            <p>
              No records match your current search or filter.
            </p>
          </div>
        ) : (
          <div className="attendance-table-wrapper">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>Course Unit</th>
                  <th>Session Date</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Location Verification</th>
                </tr>
              </thead>

              <tbody>
                {filteredRecords.map((record, index) => {
                  const status = getStatus(record.status)

                  const courseName =
                    record.courseUnitName ||
                    record.courseUnit?.name ||
                    record.courseUnitCode ||
                    record.courseUnit?.code ||
                    'Course Unit'

                  const sessionDate =
                    record.sessionStartedAt ||
                    record.recordedAt ||
                    record.createdAt

                  return (
                    <tr key={record.id || index}>
                      <td>
                        <strong>{courseName}</strong>
                        <small>
                          {record.courseUnitCode || ''}
                        </small>
                      </td>

                      <td>{formatDate(sessionDate)}</td>

                      <td>{formatTime(
                        record.signedAt || record.recordedAt
                      )}</td>

                      <td>
                        <span
                          className={`attendance-status ${status.toLowerCase()}`}
                        >
                          {getStatusIcon(status)}
                          {status}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`location-status ${
                            record.locationVerified
                              ? 'verified'
                              : 'unverified'
                          }`}
                        >
                          <MapPin size={15} />
                          {record.locationVerified
                            ? 'Verified'
                            : 'Not verified'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

      </section>

      <section className="attendance-records" aria-label="Examination attendance verification">
        <div className="attendance-records-header">
          <div>
            <h2>Examination attendance verification</h2>
            <p>Examination check-ins remain pending until reviewed by the session lecturer.</p>
          </div>
        </div>
        {examAttendance.length === 0 ? (
          <div className="attendance-empty">
            <ClipboardList size={38} />
            <h3>No examination attendance records</h3>
            <p>Examination check-ins and their verification decisions will appear here.</p>
          </div>
        ) : (
          <div className="attendance-table-wrapper">
            <table className="attendance-table">
              <thead>
                <tr><th>Assessment</th><th>Course unit</th><th>Academic year</th><th>Check-in</th><th>Verification status</th><th>Decision details</th></tr>
              </thead>
              <tbody>
                {examAttendance.map((record) => (
                  <tr key={record.id}>
                    <td>{record.session?.assessment?.code || record.session?.assessment?.name || 'Examination'}</td>
                    <td>{record.session?.courseUnit?.code} · {record.session?.courseUnit?.name}</td>
                    <td>{record.academicYear || 'Not available'}</td>
                    <td>{formatDate(record.recordedAt)}</td>
                    <td><span className={`attendance-status ${(record.examVerificationStatus || 'unknown').toLowerCase()}`}>{(record.examVerificationStatus || 'UNKNOWN').replaceAll('_', ' ')}</span></td>
                    <td>
                      {record.examRejectionReason && <span><strong>Reason:</strong> {record.examRejectionReason}</span>}
                      {record.examComments && <span><strong>Comments:</strong> {record.examComments}</span>}
                      {record.examVerifiedAt && <span><strong>Decision:</strong> {formatDate(record.examVerifiedAt)}</span>}
                      {record.examVerificationStatus === 'PENDING_REVIEW' && 'Awaiting lecturer verification'}
                      {record.examVerificationStatus === 'LEGACY_UNVERIFIED' && 'Historical outcome unavailable'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="attendance-records" aria-label="CAT submissions">
        <div className="attendance-records-header">
          <div>
            <h2>CAT submissions</h2>
            <p>CAT submissions are created automatically when CAT attendance is verified.</p>
          </div>
        </div>
        {catSubmissions.length === 0 ? (
          <div className="attendance-empty">
            <ClipboardList size={38} />
            <h3>No CAT submissions</h3>
            <p>Successful CAT check-ins will appear here for lecturer verification.</p>
          </div>
        ) : (
          <div className="attendance-table-wrapper">
            <table className="attendance-table">
              <thead>
                <tr><th>Assessment</th><th>Course unit</th><th>Academic period</th><th>Submitted</th><th>Status</th><th>Decision details</th></tr>
              </thead>
              <tbody>
                {catSubmissions.map((submission) => (
                  <tr key={submission.id}>
                    <td>{submission.assessment?.code || submission.assessment?.name || 'CAT assessment'}</td>
                    <td>{submission.assessment?.courseUnit?.code} · {submission.assessment?.courseUnit?.name}</td>
                    <td>
                      {submission.academicYear || 'Not available'}
                      {submission.academicPeriods?.map((period) => <small key={period.id}>{period.name}</small>)}
                    </td>
                    <td>{formatDate(submission.createdAt)}</td>
                    <td><span className={`attendance-status ${submission.status.toLowerCase()}`}>{submission.status.replaceAll('_', ' ')}</span></td>
                    <td>
                      {submission.rejectionReason && <span><strong>Reason:</strong> {submission.rejectionReason}</span>}
                      {submission.comments && <span><strong>Comments:</strong> {submission.comments}</span>}
                      {!submission.rejectionReason && !submission.comments && submission.status === 'PENDING_REVIEW' && 'Awaiting lecturer verification'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  )
}

export default StudentAttendance
