

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  MessageSquare,
  Send,
  Clock,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  LoaderCircle,
} from 'lucide-react'
import { getStudentReport, getStudentReportComments, addStudentReportComment } from '../../api/student'
import '../../styles/StudentReportDetails.css'

function StudentReportDetails() {
  const { reportId } = useParams()
  const navigate = useNavigate()

  const [report, setReport] = useState(null)
  const [comments, setComments] = useState([])
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [commentError, setCommentError] = useState('')

  useEffect(() => {
    const fetchReportDetails = async () => {
      try {
        setLoading(true)
        setError('')

        const [reportResponse, commentsResponse] = await Promise.all([
          getStudentReport(reportId),
          getStudentReportComments(reportId),
        ])

        setReport(reportResponse.data?.data ?? reportResponse.data)
        setComments(commentsResponse.data?.data ?? commentsResponse.data ?? [])
      } catch (err) {
        setError(
          err.response?.data?.message ||
          'Unable to load report details. Please try again.'
        )
      } finally {
        setLoading(false)
      }
    }

    fetchReportDetails()
  }, [reportId])

  const handleAddComment = async (e) => {
    e.preventDefault()

    if (!comment.trim()) {
      setCommentError('Please enter a comment.')
      return
    }

    try {
      setSubmitting(true)
      setCommentError('')

      await addStudentReportComment(reportId, comment.trim())

      const response = await getStudentReportComments(reportId)
      setComments(response.data?.data ?? response.data ?? [])
      setComment('')
    } catch (err) {
      setCommentError(
        err.response?.data?.message || 'Failed to submit comment.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return <CheckCircle size={18} />
      case 'rejected':
        return <XCircle size={18} />
      case 'pending':
        return <Clock size={18} />
      default:
        return <AlertCircle size={18} />
    }
  }

  const formatDate = (date) => {
    if (!date) return 'Not available'

    return new Date(date).toLocaleString()
  }

  if (loading) {
    return (
      <div className="report-details-loading">
        <LoaderCircle className="loading-spinner" size={30} />
        <p>Loading report details...</p>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="report-details-error">
        <AlertCircle size={32} />
        <p>{error || 'Report not found.'}</p>
        <button onClick={() => navigate('/student/reports')}>
          Back to Reports
        </button>
      </div>
    )
  }

  const status = report.status || 'Unknown'

  return (
    <div className="student-report-details">
      <button
        className="back-button"
        onClick={() => navigate('/student/reports')}
      >
        <ArrowLeft size={18} />
        Back to Reports
      </button>

      <div className="details-header">
        <div>
          <h1>Report Details</h1>
          <p>View the information and progress of your missing marks report.</p>
        </div>

        <span className={`details-status ${status.toLowerCase()}`}>
          {getStatusIcon(status)}
          {status.replaceAll('_', ' ')}
        </span>
      </div>

      <section className="details-card">
        <div className="card-heading">
          <FileText size={20} />
          <h2>Report Information</h2>
        </div>

        <div className="details-grid">
          <div>
            <span>Report ID</span>
            <strong>{report.id || report.reportId || reportId}</strong>
          </div>

          <div>
            <span>Course Unit</span>
            <strong>
              {report.courseUnit?.name ||
                report.courseUnit?.code ||
                report.courseUnitName ||
                'Not available'}
            </strong>
          </div>

          <div>
            <span>Assessment Type</span>
            <strong>
              {report.assessment?.type ||
                report.assessmentType ||
                'Not available'}
            </strong>
          </div>

          <div>
            <span>Academic Period</span>
            <strong>
              {report.academicPeriod?.name ||
                report.academicPeriodName ||
                'Not available'}
            </strong>
          </div>

          <div>
            <span>Submission Date</span>
            <strong>{formatDate(report.createdAt)}</strong>
          </div>

          <div>
            <span>Last Updated</span>
            <strong>{formatDate(report.updatedAt)}</strong>
          </div>
        </div>
      </section>

      <section className="details-card">
        <div className="card-heading">
          <FileText size={20} />
          <h2>Report Description</h2>
        </div>

        <p className="report-description">
          {report.description ||
            report.reason ||
            'No description provided.'}
        </p>
      </section>

      <section className="details-card">
        <div className="card-heading">
          <Clock size={20} />
          <h2>Report Timeline</h2>
        </div>

        {report.statusHistory?.length > 0 ? (
          <div className="report-timeline">
            {report.statusHistory.map((item, index) => (
              <div className="timeline-item" key={item.id || index}>
                <span className="timeline-dot" />

                <div>
                  <strong>
                    {item.newStatus?.replaceAll('_', ' ') ||
                      item.status?.replaceAll('_', ' ') ||
                      'Status update'}
                  </strong>
                  <p>{item.reason || item.comment || 'Report status updated.'}</p>
                  <small>{formatDate(item.createdAt)}</small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-message">
            No timeline updates available.
          </p>
        )}
      </section>

      <section className="details-card">
        <div className="card-heading">
          <MessageSquare size={20} />
          <h2>Comments</h2>
        </div>

        <div className="comments-list">
          {comments.length > 0 ? (
            comments.map((item, index) => (
              <div className="comment-item" key={item.id || index}>
                <div className="comment-header">
                  <strong>
                    {item.author?.name ||
                      item.author?.displayName ||
                      item.authorName ||
                      item.authorRole ||
                      'User'}
                  </strong>
                  <small>{formatDate(item.createdAt)}</small>
                </div>

                <p>{item.body || item.comment || item.content}</p>
              </div>
            ))
          ) : (
            <p className="empty-message">No comments yet.</p>
          )}
        </div>

        <form className="comment-form" onSubmit={handleAddComment}>
          <label htmlFor="report-comment">Add a comment</label>

          <textarea
            id="report-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Enter your comment or clarification..."
            maxLength={2000}
            rows={4}
          />

          {commentError && (
            <p className="form-error">{commentError}</p>
          )}

          <button type="submit" disabled={submitting}>
            {submitting ? (
              <LoaderCircle size={17} className="loading-spinner" />
            ) : (
              <Send size={17} />
            )}
            {submitting ? 'Submitting...' : 'Submit Comment'}
          </button>
        </form>
      </section>
    </div>
  )
}

export default StudentReportDetails
