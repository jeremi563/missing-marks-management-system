import { Link, useNavigate } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { useAuth } from '../auth/useAuth'

export default function LecturerApprovalPending() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const signOut = async () => {
    let notice
    try {
      await logout()
    } catch (error) {
      notice = error.userMessage || 'Unable to confirm sign out with the server.'
    }
    navigate('/login', { replace: true, state: notice ? { notice } : undefined })
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link to="/" className="public-brand"><span className="brand-icon"><GraduationCap size={21} /></span>Missing Marks</Link>
        <p className="eyebrow">LECTURER APPLICATION</p>
        <h1>Awaiting department COD approval</h1>
        <p className="auth-intro">Your department selection has been submitted. You can access the lecturer portal after your application is approved.</p>
        <button className="button button-secondary button-full" type="button" onClick={signOut}>Sign out</button>
        <Link className="button button-primary button-full" to="/">Return to home</Link>
      </section>
    </main>
  )
}
