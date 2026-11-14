

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
  Pencil,
  Trash2,
} from 'lucide-react'
import {
  addStudentReportComment,
  getStudentReport,
  getStudentReportComments,
  updateStudentReport,
  withdrawStudentReport,
} from '../../api/student'
import '../../styles/StudentReportDetails.css'

function unwrapResponse(response) {
  return response?.data?.data ?? response?.data ?? response
}

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
  const [isEditing, setIsEditing] = useState(false)
  const [editAssessmentComponent, setEditAssessmentComponent] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false)

  useEffect(() => {
    const fetchReportDetails = async () => {
      try {
        setLoading(true)
        setError('')

        const [reportResponse, commentsResponse] = await Promise.all([
          getStudentReport(reportId),
          getStudentReportComments(reportId),
        ])

        setReport(unwrapResponse(reportResponse))
        setComments(unwrapResponse(commentsResponse) ?? [])
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
      setComments(unwrapResponse(response) ?? [])
      setComment('')
    } catch (err) {
      setCommentError(
        err.response?.data?.message || 'Failed to submit comment.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleStartEditing = () => {
    setEditAssessmentComponent(report.assessmentComponent || '')
    setEditDescription(report.description || '')
    setActionError('')
    setActionSuccess('')
    setIsEditing(true)
  }

  const handleSaveEdit = async (event) => {
    event.preventDefault()
    const assessmentComponent = editAssessmentComponent.trim()
    const description = editDescription.trim()

    if (!assessmentComponent || !description) {
      setActionError('Assessment component and description are required.')
      return
    }

    try {
      setIsSavingEdit(true)
      setActionError('')
      const response = await updateStudentReport(reportId, {
        assessmentComponent,
        description,
      })
      const updatedReport = unwrapResponse(response)
      setReport((current) => ({ ...current, ...updatedReport }))
      setIsEditing(false)
      setActionSuccess('Report updated successfully.')
    } catch (requestError) {
      setActionError(
        requestError.response?.data?.message || 'Unable to update this report.'
      )
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleWithdraw = async () => {
    try {
      setIsWithdrawing(true)
      setActionError('')
      const response = await withdrawStudentReport(reportId)
      const updatedReport = unwrapResponse(response)
      setReport((current) => ({ ...current, ...updatedReport }))
      setIsWithdrawDialogOpen(false)
      setActionSuccess('Report withdrawn successfully.')
    } catch (requestError) {
      setActionError(
        requestError.response?.data?.message || 'Unable to withdraw this report.'
      )
    } finally {
      setIsWithdrawing(false)
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

        {isEditing ? (
          <form className="report-edit-form" onSubmit={handleSaveEdit}>
            <label htmlFor="edit-assessment-component">Assessment component</label>
            <input
              id="edit-assessment-component"
              value={editAssessmentComponent}
              onChange={(event) => setEditAssessmentComponent(event.target.value)}
              maxLength={100}
              required
            />
            <label htmlFor="edit-report-description">Description</label>
            <textarea
              id="edit-report-description"
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              maxLength={5000}
              rows={5}
              required
            />
            <div className="report-action-buttons">
              <button type="submit" disabled={isSavingEdit}>
                {isSavingEdit ? 'Saving...' : 'Save changes'}
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={() => setIsEditing(false)}
                disabled={isSavingEdit}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <p className="report-description">
              {report.description || report.reason || 'No description provided.'}
            </p>
            {String(status).toLowerCase() === 'submitted' && (
              <div className="report-action-buttons">
                <button type="button" onClick={handleStartEditing}>
                  <Pencil size={16} />
                  Edit report
                </button>
                <button
                  type="button"
                  className="danger-action"
                  onClick={() => setIsWithdrawDialogOpen(true)}
                >
                  <Trash2 size={16} />
                  Withdraw report
                </button>
              </div>
            )}
          </>
        )}
        {actionError && <p className="form-error" role="alert">{actionError}</p>}
        {actionSuccess && <p className="action-success" role="status">{actionSuccess}</p>}
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
      {isWithdrawDialogOpen && (
        <div
          className="withdraw-dialog-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isWithdrawing) {
              setIsWithdrawDialogOpen(false)
            }
          }}
        >
          <section
            className="withdraw-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="withdraw-dialog-title"
            aria-describedby="withdraw-dialog-description"
          >
            <h2 id="withdraw-dialog-title">Withdraw report?</h2>
            <p id="withdraw-dialog-description">
              This report will be marked withdrawn and can no longer be reviewed.
            </p>
            <div className="report-action-buttons">
              <button
                type="button"
                className="secondary-action"
                onClick={() => setIsWithdrawDialogOpen(false)}
                disabled={isWithdrawing}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger-action"
                onClick={handleWithdraw}
                disabled={isWithdrawing}
              >
                {isWithdrawing ? 'Please wait...' : 'Confirm withdrawal'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default StudentReportDetails
