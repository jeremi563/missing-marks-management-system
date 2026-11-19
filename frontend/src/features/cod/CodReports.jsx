import { useCallback, useState } from 'react'
import RecordListPage from '../shared/RecordListPage'
import { getCodReports } from '../../api/cod'
import CodReportPanel from './CodReportPanel'

export default function CodReports() {
  const [selectedId, setSelectedId] = useState('')
  const [scope, setScope] = useState('ESCALATED')
  const fetchReports = useCallback((params) => getCodReports({ ...params, status: scope }), [scope])
  return <>
    <div className="toolbar">
      <label htmlFor="cod-report-scope">Reports</label>
      <select id="cod-report-scope" value={scope} onChange={(event) => setScope(event.target.value)}>
        <option value="ESCALATED">Escalated</option>
        <option value="OUTSTANDING">All outstanding</option>
      </select>
    </div>
    <RecordListPage
      title={scope === 'ESCALATED' ? 'Escalated reports' : 'Outstanding reports'}
      description={scope === 'ESCALATED'
        ? 'Review reports escalated by lecturers, add a department comment, and record a final decision.'
        : 'Review unresolved departmental reports and reassign them to the appropriate lecturer.'}
      fetchRecords={fetchReports}
      collectionKeys={['reports']}
      emptyMessage={scope === 'ESCALATED' ? 'There are no reports escalated to your department.' : 'There are no outstanding reports in your departments.'}
      renderActions={(report) => <button className="button button-secondary" onClick={() => setSelectedId(report.id)}>Review</button>}
    />
    {selectedId && <CodReportPanel reportId={selectedId} onClose={() => setSelectedId('')} />}
  </>
}
