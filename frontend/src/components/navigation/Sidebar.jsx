import { NavLink } from 'react-router-dom'
import { LayoutDashboard, X } from 'lucide-react'

export default function Sidebar({ isOpen, onClose, navigationItems = [], roleLabel }) {
  return (
    <>
      {isOpen && <button className="sidebar-overlay" onClick={onClose} aria-label="Close navigation" />}
      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon"><LayoutDashboard size={21} /></div>
          <div><strong>Missing Marks</strong><small>Management System</small></div>
          <button className="sidebar-close" onClick={onClose} aria-label="Close sidebar"><X size={19} /></button>
        </div>
        <p className="sidebar-role">{roleLabel} portal</p>
        <nav className="sidebar-nav">
          {navigationItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={onClose} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              {Icon && <Icon size={18} />}<span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}
