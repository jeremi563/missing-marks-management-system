export default function LoadingState({ message = 'Loading…' }) {
  return <div className="state-card" role="status"><span className="spinner" />{message}</div>
}
