
import { Inbox } from 'lucide-react'

function EmptyState({
  title = 'No records found',
  message = 'There is nothing to display here yet.',
  action,
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Inbox size={28} />
      </div>

      <h3>{title}</h3>
      <p>{message}</p>

      {action && (
        <div className="empty-state-action">
          {action}
        </div>
      )}
    </div>
  )
}

export default EmptyState