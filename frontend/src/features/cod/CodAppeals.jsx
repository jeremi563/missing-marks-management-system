import { useState } from 'react'
import RecordListPage from '../shared/RecordListPage'
import { getCodAppeals } from '../../api/cod'
import CodDecisionPanel from './CodDecisionPanel'

export default function CodAppeals() {
  const [selectedId, setSelectedId] = useState('')
  return <>
    <RecordListPage
      title="Appeals"
      description="Review student appeals and record a reasoned decision."
      fetchRecords={getCodAppeals}
      collectionKeys={['appeals']}
      emptyMessage="There are no appeals awaiting review."
      renderActions={(appeal) => <button className="button button-secondary" onClick={() => setSelectedId(appeal.id)}>Review</button>}
    />
    {selectedId && <CodDecisionPanel id={selectedId} type="appeal" onClose={() => setSelectedId('')} />}
  </>
}
