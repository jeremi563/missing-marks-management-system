
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

function DashboardHome({ roleLabel = 'User' }) {
  return (
    <section className="dashboard-home">
      <div>
        <h2>Welcome to your {roleLabel} portal</h2>
        <p>
          Access your tools and manage your activities through the
          Missing Marks Management System.
        </p>
      </div>

      <div className="dashboard-welcome-card">
        <h3>Get started</h3>
        <p>
          Select an option from the navigation menu to continue.
        </p>
        <Link to="/">
          Return to homepage <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  )
}

export default DashboardHome