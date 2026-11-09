
import { NavLink } from 'react-router-dom'
import { X, LayoutDashboard } from 'lucide-react'

function Sidebar({ isOpen, onClose, navigationItems = [], roleLabel = 'User' }) {
  return (
    <>
      {isOpen && (
        <button
          className="sidebar-overlay"
          onClick={onClose}
          aria-label="Close navigation"
        />
      )}

      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">
            <LayoutDashboard size={22} />
          </div>

          <div>
            <h2>Missing Marks</h2>
            <span>Management System</span>
          </div>

          <button
            className="sidebar-close"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-role">{roleLabel} Portal</div>

        <nav className="sidebar-nav">
          {navigationItems.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'active' : ''}`
                }
              >
                {Icon && <Icon size={19} />}
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </aside>
    </>
  )
}

export default Sidebar