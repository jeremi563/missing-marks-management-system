import RecordListPage from '../shared/RecordListPage'
import { getCodAttendanceDiscrepancies } from '../../api/cod'

export default function CodAttendance() {
  return <RecordListPage
    title="Attendance review"
    description="Inspect attendance discrepancies raised by students and lecturers."
    fetchRecords={getCodAttendanceDiscrepancies}
    collectionKeys={['discrepancies', 'attendanceDiscrepancies']}
    emptyMessage="No attendance discrepancies need review."
  />
}
