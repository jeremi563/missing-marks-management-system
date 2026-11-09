
import { Link } from 'react-router-dom'

function AccessDenied() {
  return (
    <main className="status-page">
      <h1>403</h1>
      <h2>Access denied</h2>
      <p>You do not have permission to access this page.</p>
      <Link to="/">Return home</Link>
    </main>
  )
}

export default AccessDenied