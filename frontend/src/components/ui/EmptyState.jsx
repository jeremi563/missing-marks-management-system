export default function EmptyState({ title, message, action }) {
  return <div className="state-card"><strong>{title}</strong><p>{message}</p>{action}</div>
}
