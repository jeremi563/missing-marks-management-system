
import { Clock } from 'lucide-react'

function Timeline({ items = [] }) {
  if (!items.length) {
    return (
      <div className="timeline-empty">
        No activity history available.
      </div>
    )
  }

  return (
    <div className="timeline">
      {items.map((item, index) => (
        <div
          className="timeline-item"
          key={item.id || `${item.title}-${index}`}
        >
          <div className="timeline-indicator">
            <span className="timeline-dot" />

            {index !== items.length - 1 && (
              <span className="timeline-line" />
            )}
          </div>

          <div className="timeline-content">
            <div className="timeline-heading">
              <h4>{item.title}</h4>

              {item.date && (
                <span>
                  <Clock size={13} />
                  {new Date(item.date).toLocaleString()}
                </span>
              )}
            </div>

            {item.description && (
              <p>{item.description}</p>
            )}

            {item.actor && (
              <small>By {item.actor}</small>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default Timeline