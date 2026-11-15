import { GraduationCap } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import './PublicFooter.css'

export default function PublicFooter() {
  const { pathname } = useLocation()
  const isDashboard = /^\/(student|lecturer|cod|admin)(\/|$)/.test(pathname)

  return (
    <footer className={`public-footer${isDashboard ? ' public-footer--dashboard' : ''}`}>
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="brand-icon"><GraduationCap size={18} /></span>
          <div>
            <strong>Missing Marks</strong>
            <small>Academic support portal</small>
          </div>
        </div>

        <nav className="footer-links" aria-label="Footer navigation">
          <strong>Explore</strong>
          <Link to="/">Home</Link>
          <Link to="/#overview">How it works</Link>
          <Link to="/login">Sign in</Link>
          <Link to="/register">Lecturer registration</Link>
        </nav>

        <div className="footer-purpose">
          <strong>Academic support, with clarity.</strong>
          <p>Track missing-mark reports from submission through review to resolution.</p>
        </div>

        <div className="footer-meta">
          <span>© {new Date().getFullYear()} Missing Marks</span>
          <span>All rights reserved.</span>
        </div>
      </div>
    </footer>
  )
}
