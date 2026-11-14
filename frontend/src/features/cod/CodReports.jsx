import { useState } from 'react'
import RecordListPage from '../shared/RecordListPage'
import { getCodReports } from '../../api/cod'
import CodReportPanel from './CodReportPanel'

export default function CodReports() {
  const [selectedId, setSelectedId] = useState('')
  return <>
    <RecordListPage
      title="Escalated reports"
      description="Review reports escalated by lecturers, add a department comment, and record a final decision."
      fetchRecords={getCodReports}
      collectionKeys={['reports']}
      emptyMessage="There are no reports escalated to your department."
      renderActions={(report) => <button className="button button-secondary" onClick={() => setSelectedId(report.id)}>Review</button>}
    />
    {selectedId && <CodReportPanel reportId={selectedId} onClose={() => setSelectedId('')} />}
  </>
}
