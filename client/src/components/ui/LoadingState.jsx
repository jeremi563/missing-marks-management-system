
import { LoaderCircle } from 'lucide-react'

function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="loading-spinner" size={28} />
      <p>{message}</p>
    </div>
  )
}

export default LoadingState