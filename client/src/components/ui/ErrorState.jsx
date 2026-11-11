
import { AlertCircle, RefreshCw } from 'lucide-react'

function ErrorState({
  title = 'Unable to load information',
  message = 'Something went wrong. Please try again.',
  onRetry,
}) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={30} />

      <h3>{title}</h3>
      <p>{message}</p>

      {onRetry && (
        <button type="button" onClick={onRetry}>
          <RefreshCw size={16} />
          Try again
        </button>
      )}
    </div>
  )
}

export default ErrorState