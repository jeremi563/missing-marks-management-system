import { Menu } from 'lucide-react'

export default function Topbar({ title, userName, roleLabels = [], onMenuClick }) {
  return (
    <header className="topbar">
      <button className="menu-button" onClick={onMenuClick} aria-label="Open navigation"><Menu size={21} /></button>
      <h1>{title}</h1>
      <div className="topbar-user">
        <div className="topbar-role-badges" role="group" aria-label="Account roles">
          {roleLabels.map((role) => <span className="topbar-role-badge" key={role}>{role}</span>)}
        </div>
        <span>{userName || 'Account'}</span>
      </div>
    </header>
  )
}
