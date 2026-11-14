import RecordListPage from '../shared/RecordListPage'
import { getLecturerSpecialCases } from '../../api/lecturer'

export default function LecturerSpecialCases() {
  return <RecordListPage
    title="Special cases"
    description="View student cases that need additional review."
    fetchRecords={getLecturerSpecialCases}
    collectionKeys={['cases', 'specialCases']}
    emptyMessage="There are no special cases assigned to you."
  />
}
