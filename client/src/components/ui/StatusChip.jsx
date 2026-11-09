
function StatusChip({ status }) {
  const normalizedStatus = String(status || 'UNKNOWN')
    .trim()
    .toUpperCase()

  const statusStyles = {
    SUBMITTED: 'status-submitted',
    PENDING: 'status-pending',
    APPROVED: 'status-approved',
    REJECTED: 'status-rejected',
    ESCALATED: 'status-escalated',
    WITHDRAWN: 'status-withdrawn',

    ACTIVE: 'status-active',
    COMPLETED: 'status-completed',
    SCHEDULED: 'status-scheduled',

    PENDING_REVIEW: 'status-pending',
    CORRECTION_APPLIED: 'status-approved',
  }

  const label = normalizedStatus
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase())

  const className = statusStyles[normalizedStatus] || 'status-unknown'

  return (
    <span className={`status-chip ${className}`}>
      {label}
    </span>
  )
}

export default StatusChip