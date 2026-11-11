import { Menu, LogOut } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import ThemeToggle from '../ui/ThemeToggle'

export default function Topbar({ title, userName, onMenuClick }) {
  const { logout } = useAuth()
  return (
    <header className="topbar">
      <button className="menu-button" onClick={onMenuClick} aria-label="Open navigation"><Menu size={21} /></button>
      <h1>{title}</h1>
      <ThemeToggle />
      <div className="topbar-user">
        <span>{userName || 'Account'}</span>
        <button onClick={logout} className="icon-button" aria-label="Sign out" title="Sign out"><LogOut size={18} /></button>
      </div>
    </header>
  )
}
