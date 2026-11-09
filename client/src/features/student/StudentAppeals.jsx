

import { useEffect, useState } from 'react'
import {
  FileText,
  MessageSquare,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  LoaderCircle,
  X,
} from 'lucide-react'
import {
  getStudentReports,
  createStudentAppeal,
} from '../../api/student'
import '../../styles/StudentAppeals.css'

function StudentAppeals() {
  const [reports, setReports] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [appealReason, setAppealReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const extractData = (response) => {
    if (Array.isArray(response)) return response

    return (
      response?.data?.reports ||
      response?.data?.data ||
      response?.data ||
      response?.reports ||
      []
    )
  }

  const fetchReports = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await getStudentReports()
      const result = extractData(response)

      setReports(Array.isArray(result) ? result : [])
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Unable to retrieve your reports.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  const rejectedReports = reports.filter(
    (report) => report.status?.toLowerCase() === 'rejected'
  )

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
      case 'resolved':
        return <CheckCircle size={17} />

      case 'rejected':
        return <XCircle size={17} />

      case 'pending':
      case 'under_review':
        return <Clock size={17} />

      default:
        return <AlertCircle size={17} />
    }
  }

  const formatDate = (date) => {
    if (!date) return 'Not available'

    return new Date(date).toLocaleDateString()
  }

  const handleSubmitAppeal = async (e) => {
    e.preventDefault()

    if (!appealReason.trim()) {
      setError('Please provide a reason for your appeal.')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      setSuccess('')

      await createStudentAppeal(selectedReport.id, {
        reason: appealReason.trim(),
      })

      setSuccess('Your appeal has been submitted successfully.')
      setSelectedReport(null)
      setAppealReason('')

      await fetchReports()
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Unable to submit your appeal. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="appeals-loading">
        <LoaderCircle size={30} className="appeals-spinner" />
        <p>Loading your appeals...</p>
      </div>
    )
  }

  return (
    <div className="student-appeals">

      <div className="appeals-header">
        <div>
          <h1>Student Appeals</h1>
          <p>
            Review rejected missing-mark reports and submit appeals
            where permitted.
          </p>
        </div>

        <div className="appeals-count">
          <FileText size={19} />
          <span>{rejectedReports.length} Rejected Reports</span>
        </div>
      </div>

      {error && (
        <div className="appeals-alert error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => setError('')}>
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="appeals-alert success">
          <CheckCircle size={18} />
          <span>{success}</span>
          <button onClick={() => setSuccess('')}>
            <X size={16} />
          </button>
        </div>
      )}

      <section className="appeals-section">
        <div className="appeals-section-heading">
          <div>
            <h2>Rejected Reports</h2>
            <p>
              Select an eligible rejected report to submit an appeal.
            </p>
          </div>
        </div>

        {rejectedReports.length === 0 ? (
          <div className="appeals-empty">
            <CheckCircle size={38} />
            <h3>No Rejected Reports</h3>
            <p>
              You currently have no rejected reports requiring an appeal.
            </p>
          </div>
        ) : (
          <div className="appeals-list">
            {rejectedReports.map((report) => {
              const existingAppeal = report.appeals?.[0]

              return (
                <div className="appeal-report-card" key={report.id}>

                  <div className="appeal-report-top">
                    <div className="appeal-report-icon">
                      <FileText size={22} />
                    </div>

                    <span className="appeal-status rejected">
                      <XCircle size={15} />
                      Rejected
                    </span>
                  </div>

                  <div className="appeal-report-info">
                    <h3>
                      {report.courseUnit?.name ||
                        report.courseUnit?.code ||
                        report.courseUnitName ||
                        'Course Unit'}
                    </h3>

                    <p>
                      {report.assessmentComponent ||
                        report.assessmentType ||
                        'Assessment'}
                    </p>

                    <div className="appeal-report-meta">
                      <span>
                        Report ID: {report.reference || report.id}
                      </span>

                      <span>
                        <Clock size={14} />
                        {formatDate(
                          report.updatedAt || report.createdAt
                        )}
                      </span>
                    </div>

                    {report.description && (
                      <p className="appeal-description">
                        {report.description}
                      </p>
                    )}
                  </div>

                  {existingAppeal ? (
                    <div className="existing-appeal">
                      <MessageSquare size={17} />

                      <div>
                        <strong>Appeal already submitted</strong>
                        <p>
                          Status: {
                            existingAppeal.status || 'Under review'
                          }
                        </p>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="submit-appeal-button"
                      onClick={() => {
                        setSelectedReport(report)
                        setAppealReason('')
                        setError('')
                      }}
                    >
                      <Send size={16} />
                      Submit Appeal
                    </button>
                  )}

                </div>
              )
            })}
          </div>
        )}
      </section>

      {selectedReport && (
        <div className="appeal-modal-overlay">
          <div className="appeal-modal">

            <div className="appeal-modal-header">
              <div>
                <h2>Submit Appeal</h2>
                <p>
                  Explain why you believe this decision should be reviewed.
                </p>
              </div>

              <button
                className="close-appeal-modal"
                onClick={() => {
                  setSelectedReport(null)
                  setError('')
                }}
                disabled={submitting}
              >
                <X size={21} />
              </button>
            </div>

            <div className="selected-report-info">
              <strong>
                {selectedReport.courseUnit?.name ||
                  selectedReport.courseUnit?.code ||
                  selectedReport.courseUnitName ||
                  'Course Unit'}
              </strong>

              <span>
                Report ID: {selectedReport.reference || selectedReport.id}
              </span>
            </div>

            <form
              className="appeal-form"
              onSubmit={handleSubmitAppeal}
            >
              <label htmlFor="appeal-reason">
                Reason for Appeal
              </label>

              <textarea
                id="appeal-reason"
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                placeholder="Explain why you are requesting a review of this decision..."
                rows={6}
                maxLength={2000}
                required
              />

              <div className="appeal-character-count">
                {appealReason.length}/2000 characters
              </div>

              <div className="appeal-form-actions">
                <button
                  type="button"
                  className="cancel-appeal-button"
                  onClick={() => {
                    setSelectedReport(null)
                    setError('')
                  }}
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="confirm-appeal-button"
                  disabled={submitting || !appealReason.trim()}
                >
                  {submitting ? (
                    <LoaderCircle
                      size={17}
                      className="appeals-spinner"
                    />
                  ) : (
                    <Send size={17} />
                  )}

                  {submitting ? 'Submitting...' : 'Submit Appeal'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  )
}

export default StudentAppeals
