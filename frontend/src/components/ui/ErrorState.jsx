export default function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="state-card error-state" role="alert">
      <strong>{title}</strong><p>{message}</p>
      {onRetry && <button className="button button-secondary" onClick={onRetry}>Try again</button>}
    </div>
  )
}
