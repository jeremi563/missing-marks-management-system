

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
import { getStudentAttendance } from '../../api/student'
import '../../styles/StudentAttendance.css'

function StudentAttendance() {
  const [records, setRecords] = useState([])
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

        const response = await getStudentAttendance()
        const data = response?.data ?? response

        setRecords(Array.isArray(data) ? data : data?.records ?? [])
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

    </div>
  )
}

export default StudentAttendance
