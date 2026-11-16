import { Link } from 'react-router-dom'

export default function AccessDenied() {
  return (
    <main className="status-page">
      <p className="eyebrow">403</p>
      <h1>Access denied</h1>
      <p>Your account does not have permission to view this page.</p>
      <Link to="/">Return to home</Link>
    </main>
  )
}
