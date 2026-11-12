import {
  ArrowRight, BellRing, Check, ClipboardCheck, FileSearch, GraduationCap, ShieldCheck,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const benefits = [
  {
    icon: FileSearch,
    title: 'One clear process',
    description: 'Submit a missing-mark report and keep its progress, updates, and outcome in one place.',
  },
  {
    icon: ClipboardCheck,
    title: 'Made for academic teams',
    description: 'Lecturers and academic officers get focused tools to review and resolve assigned cases.',
  },
  {
    icon: BellRing,
    title: 'Stay in the loop',
    description: 'Follow case updates and keep the right people informed throughout the review.',
  },
]

export default function LandingPage() {
  return (
    <main className="landing-page">
      <header className="public-nav">
        <Link className="public-brand" to="/">
          <span className="brand-icon"><GraduationCap size={21} /></span>
          <span>Missing Marks<small>Academic support portal</small></span>
        </Link>
        <nav aria-label="Main navigation">
          <Link className="public-login-link" to="/login">Sign in</Link>
          <Link className="button button-primary" to="/register">Get started <ArrowRight size={16} /></Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="hero-eyebrow-dot" /> ACADEMIC RECORDS, MADE CLEARER</p>
          <h1>Every mark matters.<br /><span>Every case has a path.</span></h1>
          <p className="hero-description">
            A calm, transparent way to report missing assessment marks and follow each case from submission to resolution.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/register">Create your account <ArrowRight size={17} /></Link>
            <Link className="button button-secondary" to="/login">Sign in to your account</Link>
          </div>
          <div className="hero-assurance">
            <span><ShieldCheck size={17} /> Private by role</span>
            <span><Check size={17} /> Clear status updates</span>
          </div>
        </div>

        <div className="landing-preview" aria-label="Example missing mark report progress">
          <div className="preview-window-bar"><div className="preview-brand-mark"><GraduationCap size={15} /></div><span>Case overview</span><span className="preview-window-dots">•••</span></div>
          <div className="preview-content">
            <div className="preview-heading"><div><small>REPORT MM-2048</small><h2>Assessment mark enquiry</h2></div><span className="preview-status">In review</span></div>
            <div className="preview-course"><span className="preview-course-icon"><FileSearch size={18} /></span><div><strong>Applied Mathematics II</strong><small>Continuous assessment · Submitted 12 Oct</small></div></div>
            <div className="preview-progress"><div className="preview-progress-label"><span>Review progress</span><strong>2 of 3 steps</strong></div><div className="preview-progress-track"><span /></div></div>
            <ol className="preview-timeline">
              <li className="complete"><span><Check size={12} /></span><div><strong>Report received</strong><small>Your case is safely recorded</small></div></li>
              <li className="current"><span>2</span><div><strong>Lecturer review</strong><small>Under assessment</small></div></li>
              <li><span>3</span><div><strong>Outcome shared</strong><small>We’ll notify you when ready</small></div></li>
            </ol>
          </div>
          <div className="preview-footnote"><ShieldCheck size={15} /> Your records are visible only to the right people.</div>
        </div>
      </section>

      <section className="landing-benefits">
        <div className="landing-section-heading">
          <p className="eyebrow">A BETTER WAY TO FOLLOW UP</p>
          <h2>Clarity for every step.</h2>
          <p>Designed to make academic mark enquiries easier to submit, review, and resolve.</p>
        </div>
        <div className="benefit-grid">
          {benefits.map(({ icon: Icon, title, description }, index) => (
            <article className="benefit-card" key={title}>
              <span className="benefit-icon"><Icon size={20} /></span>
              <span className="benefit-index">0{index + 1}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <div><p className="eyebrow">READY WHEN YOU ARE</p><h2>Get the clarity your case deserves.</h2><p>Sign in to follow your reports, or create an account to get started.</p></div>
        <Link className="button button-light" to="/register">Create an account <ArrowRight size={17} /></Link>
      </section>
      <footer className="public-footer"><span>Missing Marks Management System</span><span>Academic support, with clarity.</span></footer>
    </main>
  )
}
