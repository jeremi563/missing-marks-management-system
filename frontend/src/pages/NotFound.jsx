import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <main className="status-page">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p>The page you requested does not exist.</p>
      <Link to="/">Return to home</Link>
    </main>
  )
}
