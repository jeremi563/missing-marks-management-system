import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, LayoutDashboard, LogOut, X } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'

function itemMatchesPath(item, pathname) {
  if (item.matchesRoute) return item.matchesRoute(pathname)
  return item.end
    ? pathname === item.to
    : pathname === item.to || pathname.startsWith(`${item.to}/`)
}

export default function Sidebar({ isOpen, onClose, navigationItems = [], roleLabel }) {
  const { logout } = useAuth()
  const { pathname } = useLocation()
  const [menuState, setMenuState] = useState({ pathname: '', group: null })
  const renderLink = (item, className = 'sidebar-link') => {
    const { to, label, icon: Icon, end } = item
    return (
    <NavLink
      key={to}
      to={to}
      end={end}
      onClick={onClose}
      className={({ isActive }) => `${className} ${(item.matchesRoute ? item.matchesRoute(pathname) : isActive) ? 'active' : ''}`}
    >
      {Icon && <Icon size={18} />}<span>{label}</span>
    </NavLink>
    )
  }

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
        <nav className="sidebar-nav" aria-label={`${roleLabel} navigation`}>
          {navigationItems.map((item) => {
            if (!item.items) return renderLink(item)

            const Icon = item.icon
            const groupId = `sidebar-group-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
            const containsActivePage = item.items.some((link) => itemMatchesPath(link, pathname))
            const isExpanded = menuState.pathname === pathname
              ? menuState.group === item.label
              : containsActivePage

            return (
              <div className="sidebar-group" key={item.label}>
                <button
                  type="button"
                  className={`sidebar-group-toggle ${containsActivePage ? 'active' : ''}`}
                  aria-expanded={isExpanded}
                  aria-controls={groupId}
                  onClick={() => setMenuState({
                    pathname,
                    group: isExpanded ? null : item.label,
                  })}
                >
                  {Icon && <Icon size={18} />}
                  <span>{item.label}</span>
                  <ChevronDown className="sidebar-group-chevron" size={16} aria-hidden="true" />
                </button>
                <div id={groupId} hidden={!isExpanded} className={`sidebar-group-links ${isExpanded ? 'open' : ''}`}>
                  {item.items.map((link) => renderLink(link, 'sidebar-link sidebar-sub-link'))}
                </div>
              </div>
            )
          })}
        </nav>
        <button className="sidebar-signout" onClick={logout}>
          <LogOut size={18} /><span>Sign out</span>
        </button>
      </aside>
    </>
  )
}
