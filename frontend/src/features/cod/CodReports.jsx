import { useState } from 'react'
import RecordListPage from '../shared/RecordListPage'
import { getCodReports } from '../../api/cod'
import CodReportPanel from './CodReportPanel'

export default function CodReports() {
  const [selectedId, setSelectedId] = useState('')
  return <>
    <RecordListPage
      title="Department reports"
      description="Open a report to inspect its details, assign an eligible lecturer, add a comment, or decide the case."
      fetchRecords={getCodReports}
      collectionKeys={['reports']}
      emptyMessage="There are no department reports to review."
      renderActions={(report) => <button className="button button-secondary" onClick={() => setSelectedId(report.id)}>Review</button>}
    />
    {selectedId && <CodReportPanel reportId={selectedId} onClose={() => setSelectedId('')} />}
  </>
}
