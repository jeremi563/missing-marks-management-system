import { useState } from 'react'
import RecordListPage from '../shared/RecordListPage'
import { getLecturerReports, startLecturerReport } from '../../api/lecturer'
import ReportReviewPanel from './ReportReviewPanel'

export default function LecturerReports() {
  const [selectedId, setSelectedId] = useState('')
  const [error, setError] = useState('')
  const openReport = async (report) => {
    setError('')
    try {
      await startLecturerReport(report.id)
      setSelectedId(report.id)
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to start report review.')
    }
  }
  return <>
    {error && <div className="form-alert" role="alert">{error}</div>}
    <RecordListPage
      title="Assigned reports"
      description="Open a report to review its details, add comments, make a decision, escalate, or propose a correction."
      fetchRecords={getLecturerReports}
      collectionKeys={['reports']}
      emptyMessage="No reports have been assigned to you."
      renderActions={(report) => <button className="button button-secondary" onClick={() => openReport(report)}>Review</button>}
    />
    {selectedId && <ReportReviewPanel reportId={selectedId} onClose={() => setSelectedId('')} />}
  </>
}
