

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'

import { getStudentReports } from '../../api/student'
import StatusChip from '../../components/ui/StatusChip'
import LoadingState from '../../components/ui/LoadingState'
import ErrorState from '../../components/ui/ErrorState'
import EmptyState from '../../components/ui/EmptyState'
import Pager from '../../components/ui/Pager'

import '../../styles/StudentReports.css'

const PAGE_SIZE = 10

function normalizeResponse(response) {
  const result = response?.data ?? response
  const data = result?.data ?? result

  const reports = Array.isArray(data)
    ? data
    : data?.reports || data?.items || []

  const pagination = result?.pagination || data?.pagination || data?.meta || {}

  return {
    reports,
    totalPages: Number(
      pagination.totalPages ??
      pagination.total_pages ??
      Math.max(1, Math.ceil(Number(pagination.total ?? reports.length) / 100))
    ),
  }
}

function StudentReports() {
  const [allReports, setAllReports] = useState([])
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const loadReports = useCallback(async () => {
    const firstPage = normalizeResponse(
      await getStudentReports({ page: 1, limit: 100 })
    )
    const reports = [...firstPage.reports]

    for (let currentPage = 2; currentPage <= firstPage.totalPages; currentPage += 1) {
      const result = normalizeResponse(
        await getStudentReports({ page: currentPage, limit: 100 })
      )
      reports.push(...result.reports)
    }

    return reports
  }, [])

  useEffect(() => {
    let isCurrent = true

    const load = async () => {
      try {
        const reports = await loadReports()

        if (isCurrent) {
          setAllReports(reports)
          setError('')
        }
      } catch (err) {
        if (isCurrent) {
          setError(err.userMessage || 'Unable to load your reports.')
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
  }, [loadReports, refreshKey])

  const normalizedStatus = (reportStatus) =>
    String(reportStatus || '')
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_')

  const filteredReports = status
    ? allReports.filter(
        (report) => normalizedStatus(report.status) === status
      )
    : allReports
  const total = filteredReports.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const reports = filteredReports.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  )

  const handleRetry = () => {
    setLoading(true)
    setError('')
    setRefreshKey((key) => key + 1)
  }

  const handleStatusChange = (event) => {
    setStatus(event.target.value)
    setPage(1)
  }

  return (
    <section className="student-reports-page">
      <div className="student-reports-header">
        <div>
          <p className="student-eyebrow">STUDENT PORTAL</p>
          <h2>My Missing-Mark Reports</h2>
          <p>View and track the progress of your submitted reports.</p>
        </div>
      </div>

      <div className="student-reports-toolbar">
        <div className="student-reports-count">
          <FileText size={19} />
          <span>{total} report(s)</span>
        </div>

        <div className="student-filter">
          <label htmlFor="report-status">Filter by status</label>
          <select
            id="report-status"
            value={status}
            onChange={handleStatusChange}
          >
            <option value="">All statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="ESCALATED">Escalated</option>
            <option value="WITHDRAWN">Withdrawn</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading your reports..." />
      ) : error ? (
        <ErrorState
          title="Unable to load reports"
          message={error}
          onRetry={handleRetry}
        />
      ) : reports.length === 0 ? (
        <EmptyState
          title="No reports found"
          message={
            status
              ? 'No reports match the selected status.'
              : 'You have not submitted any missing-mark reports yet.'
          }
          action={
            status ? (
              <button
                type="button"
                className="student-clear-filter"
                onClick={() => {
                  setStatus('')
                  setPage(1)
                }}
              >
                Clear filter
              </button>
            ) : null
          }
        />
      ) : (
        <>
          <div className="student-reports-list">
            {reports.map((report) => (
              <article className="student-report-card" key={report.id}>
                <div className="student-report-main">
                  <div className="student-report-icon">
                    <FileText size={21} />
                  </div>

                  <div className="student-report-information">
                    <h3>
                      {report.reference ||
                        report.reportNumber ||
                        report.referenceNumber ||
                        `Report ${report.id}`}
                    </h3>

                    <p>
                      {report.courseUnit?.code ||
                        report.courseUnitCode ||
                        report.courseUnit?.name ||
                        'Course unit unavailable'}
                    </p>

                    <small>
                      Submitted:{' '}
                      {(report.submittedAt || report.createdAt)
                        ? new Date(
                            report.submittedAt || report.createdAt
                          ).toLocaleDateString()
                        : 'Date unavailable'}
                    </small>
                  </div>
                </div>

                <div className="student-report-actions">
                  <StatusChip status={report.status} />

                  <Link to={`/student/reports/${report.id}`}>
                    View details
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <Pager
            page={page}
            totalPages={totalPages}
            total={total}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  )
}

export default StudentReports
