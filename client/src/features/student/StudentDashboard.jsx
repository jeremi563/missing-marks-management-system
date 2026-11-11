
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  PlusCircle,
  ArrowRight,
} from 'lucide-react'

import {
  getStudentProfile,
  getStudentReports,
} from '../../api/student'

import StatusChip from '../../components/ui/StatusChip'
import LoadingState from '../../components/ui/LoadingState'
import ErrorState from '../../components/ui/ErrorState'

import '../../styles/StudentDashboard.css'

function unwrapResponse(response) {
  return response?.data ?? response
}

function getReportsPage(response) {
  const result = unwrapResponse(response)
  const data = result?.data ?? result

  const reports = Array.isArray(data)
    ? data
    : Array.isArray(data?.reports)
      ? data.reports
      : Array.isArray(data?.items)
        ? data.items
        : []

  return {
    reports,
    pagination: result?.pagination ?? response?.pagination,
  }
}

function StudentDashboard() {
  const [profile, setProfile] = useState(null)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const loadDashboard = useCallback(async () => {
    const [profileResponse, reportsResponse] = await Promise.all([
      getStudentProfile(),
      getStudentReports({ page: 1, limit: 100 }),
    ])

    const firstPage = getReportsPage(reportsResponse)
    const allReports = [...firstPage.reports]
    const totalPages = Number(firstPage.pagination?.totalPages)

    for (let page = 2; page <= totalPages; page += 1) {
      const pageResponse = await getStudentReports({ page, limit: 100 })
      allReports.push(...getReportsPage(pageResponse).reports)
    }

    return {
      profile: unwrapResponse(profileResponse),
      reports: allReports,
    }
  }, [])

  useEffect(() => {
    let isCurrent = true

    const load = async () => {
      try {
        const dashboard = await loadDashboard()

        if (isCurrent) {
          setProfile(dashboard.profile)
          setReports(dashboard.reports)
          setError('')
        }
      } catch (err) {
        if (isCurrent) {
          setError(
            err.userMessage || 'Unable to load your dashboard information.'
          )
        }
      } finally {
        if (isCurrent) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      isCurrent = false
    }
  }, [loadDashboard, refreshKey])

  const handleRetry = () => {
    setLoading(true)
    setError('')
    setRefreshKey((key) => key + 1)
  }

  if (loading) {
    return <LoadingState message="Loading your dashboard..." />
  }

  if (error) {
    return (
      <ErrorState
        title="Dashboard unavailable"
        message={error}
        onRetry={handleRetry}
      />
    )
  }

  const normalizeStatus = (status) =>
    String(status || '')
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_')

  const submitted = reports.filter((report) =>
    ['SUBMITTED', 'PENDING', 'PENDING_REVIEW', 'UNDER_REVIEW'].includes(
      normalizeStatus(report.status)
    )
  ).length

  const approved = reports.filter(
    (report) => normalizeStatus(report.status) === 'APPROVED'
  ).length

  const rejected = reports.filter(
    (report) => normalizeStatus(report.status) === 'REJECTED'
  ).length

  const studentName =
    profile?.fullName ||
    profile?.name ||
    profile?.user?.displayName ||
    profile?.user?.fullName ||
    profile?.user?.name ||
    'Student'

  const registrationNumber =
    profile?.registrationNumber ||
    profile?.registrationNo ||
    profile?.studentNumber ||
    profile?.student?.studentNumber ||
    profile?.student?.registrationNumber ||
    ''

  const recentReports = reports.slice(0, 5)

  const summaryCards = [
    {
      label: 'Total Reports',
      value: reports.length,
      icon: FileText,
      className: 'student-stat-blue',
    },
    {
      label: 'Pending Reports',
      value: submitted,
      icon: Clock,
      className: 'student-stat-orange',
    },
    {
      label: 'Approved Reports',
      value: approved,
      icon: CheckCircle,
      className: 'student-stat-green',
    },
    {
      label: 'Rejected Reports',
      value: rejected,
      icon: XCircle,
      className: 'student-stat-red',
    },
  ]

  return (
    <section className="student-dashboard">
      <div className="student-welcome">
        <div>
          <p className="student-eyebrow">STUDENT PORTAL</p>
          <h2>Welcome, {studentName}</h2>
          <p>
            Manage your missing-mark reports and keep track of their progress.
          </p>

          {registrationNumber && (
            <span className="student-registration">
              Registration Number: {registrationNumber}
            </span>
          )}
        </div>

        <Link to="/student/reports/new" className="student-primary-button">
          <PlusCircle size={18} />
          Submit a Report
        </Link>
      </div>

      <div className="student-summary-grid">
        {summaryCards.map((card) => {
          const Icon = card.icon

          return (
            <article className="student-summary-card" key={card.label}>
              <div className={`student-stat-icon ${card.className}`}>
                <Icon size={21} />
              </div>

              <div>
                <p>{card.label}</p>
                <h3>{card.value}</h3>
              </div>
            </article>
          )
        })}
      </div>

      <div className="student-recent-section">
        <div className="student-section-heading">
          <div>
            <h3>Recent Missing-Mark Reports</h3>
            <p>Keep track of your recently submitted reports.</p>
          </div>

          <Link to="/student/reports">
            View all <ArrowRight size={16} />
          </Link>
        </div>

        {recentReports.length === 0 ? (
          <div className="student-empty-reports">
            <FileText size={32} />
            <h4>No reports yet</h4>
            <p>
              You haven't submitted any missing-mark reports.
            </p>
            <Link to="/student/reports/new">
              Submit your first report
            </Link>
          </div>
        ) : (
          <div className="student-reports-table-wrapper">
            <table className="student-reports-table">
              <thead>
                <tr>
                  <th>Report</th>
                  <th>Course Unit</th>
                  <th>Date Submitted</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {recentReports.map((report) => (
                  <tr key={report.id}>
                    <td>
                      {report.reference ||
                        report.reportNumber ||
                        report.referenceNumber ||
                        report.id}
                    </td>

                    <td>
                      {report.courseUnit?.code ||
                        report.courseUnit?.name ||
                        report.courseUnitCode ||
                        'N/A'}
                    </td>

                    <td>
                      {report.createdAt
                        ? new Date(report.createdAt).toLocaleDateString()
                        : 'N/A'}
                    </td>

                    <td>
                      <StatusChip status={report.status} />
                    </td>

                    <td>
                      <Link
                        to={`/student/reports/${report.id}`}
                        className="student-view-link"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

export default StudentDashboard