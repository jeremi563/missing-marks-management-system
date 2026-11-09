
import { Link } from 'react-router-dom'
import {
  GraduationCap,
  ClipboardCheck,
  ShieldCheck,
  ArrowRight,
  FileSearch,
  Clock,
  Users,
} from 'lucide-react'
import '../styles/LandingPage.css'

const features = [
  {
    icon: FileSearch,
    title: 'Report Missing Marks',
    description:
      'Submit and track missing marks reports through a structured process.',
  },
  {
    icon: Clock,
    title: 'Track Progress',
    description:
      'Follow report updates and stay informed about decisions.',
  },
  {
    icon: ShieldCheck,
    title: 'Transparent Management',
    description:
      'Support accountable handling of missing marks across university departments.',
  },
]

function LandingPage() {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <Link to="/" className="landing-brand">
          <div className="landing-logo">
            <GraduationCap size={25} />
          </div>
          <span>Missing Marks MS</span>
        </Link>

        <nav className="landing-nav">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <Link to="/login" className="landing-login">
            Sign in
          </Link>
        </nav>
      </header>

      <main>
        <section className="landing-hero">
          <div className="hero-content">
            <span className="hero-tag">
              University Academic Records Management
            </span>

            <h1>
              Missing marks?
              <span> Get them resolved.</span>
            </h1>

            <p>
              A centralized platform for reporting, investigating and
              managing missing academic marks. Stay informed throughout
              the resolution process.
            </p>

            <div className="hero-actions">
              <Link to="/login" className="primary-cta">
                Access Portal <ArrowRight size={18} />
              </Link>

              <a href="#how-it-works" className="secondary-cta">
                Learn More
              </a>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-card">
              <div className="hero-card-icon">
                <ClipboardCheck size={30} />
              </div>
              <h3>Missing Marks Management</h3>
              <p>Report. Investigate. Resolve.</p>

              <div className="hero-card-divider" />

              <div className="hero-stat">
                <Users size={20} />
                <span>Connected academic stakeholders</span>
              </div>

              <div className="hero-stat">
                <ShieldCheck size={20} />
                <span>Structured report management</span>
              </div>
            </div>
          </div>
        </section>

        <section className="features-section" id="features">
          <div className="section-heading">
            <span>Platform Features</span>
            <h2>One platform, a structured process</h2>
            <p>
              Tools that support the different stages of missing marks
              management.
            </p>
          </div>

          <div className="features-grid">
            {features.map((feature) => {
              const Icon = feature.icon

              return (
                <article className="feature-card" key={feature.title}>
                  <div className="feature-icon">
                    <Icon size={24} />
                  </div>

                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              )
            })}
          </div>
        </section>

        <section className="how-section" id="how-it-works">
          <div>
            <span className="section-eyebrow">How it works</span>
            <h2>A clear path towards resolution</h2>
            <p>
              The platform connects students and university staff through
              a coordinated missing marks reporting process.
            </p>
          </div>

          <div className="process-steps">
            <div className="process-step">
              <span>01</span>
              <h3>Submit</h3>
              <p>Students submit missing marks reports.</p>
            </div>

            <div className="process-step">
              <span>02</span>
              <h3>Investigate</h3>
              <p>Lecturers review assigned reports.</p>
            </div>

            <div className="process-step">
              <span>03</span>
              <h3>Resolve</h3>
              <p>Authorized staff handle final decisions.</p>
            </div>
          </div>
        </section>

        <section className="landing-cta">
          <h2>Ready to access the system?</h2>
          <p>Sign in using your university account.</p>
          <Link to="/login" className="primary-cta">
            Sign in to continue <ArrowRight size={18} />
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <p>
          © {new Date().getFullYear()} Missing Marks Management System.
          All rights reserved.
        </p>
      </footer>
    </div>
  )
}

export default LandingPage