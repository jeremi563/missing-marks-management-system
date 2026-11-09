
import { Menu, Bell, UserCircle } from 'lucide-react'

function Topbar({ title, userName = 'User', onMenuClick }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="menu-toggle"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu size={23} />
        </button>

        <div>
          <h1>{title}</h1>
          <p>Missing Marks Management System</p>
        </div>
      </div>

      <div className="topbar-actions">
        <button className="icon-button" aria-label="Notifications">
          <Bell size={21} />
        </button>

        <div className="user-summary">
          <UserCircle size={30} />
          <span>{userName}</span>
        </div>
      </div>
    </header>
  )
}

export default Topbar