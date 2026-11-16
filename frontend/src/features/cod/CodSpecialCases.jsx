import { useState } from 'react'
import RecordListPage from '../shared/RecordListPage'
import { getCodSpecialCases } from '../../api/cod'
import CodDecisionPanel from './CodDecisionPanel'

export default function CodSpecialCases() {
  const [selectedId, setSelectedId] = useState('')
  return <>
    <RecordListPage
      title="Special cases"
      description="Review escalated student cases and department-level special-case requests."
      fetchRecords={getCodSpecialCases}
      collectionKeys={['cases', 'specialCases']}
      emptyMessage="There are no special cases awaiting review."
      renderActions={(item) => <button className="button button-secondary" onClick={() => setSelectedId(item.id)}>Review</button>}
    />
    {selectedId && <CodDecisionPanel id={selectedId} type="case" onClose={() => setSelectedId('')} />}
  </>
}
