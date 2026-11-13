import { Menu, UserRound } from 'lucide-react'

export default function Topbar({ title, userName, avatarData, onMenuClick }) {
  return (
    <header className="topbar">
      <button className="menu-button" onClick={onMenuClick} aria-label="Open navigation"><Menu size={21} /></button>
      <h1>{title}</h1>
      <div className="topbar-user">
        <span className="topbar-avatar" aria-hidden="true">
          {avatarData ? <img src={avatarData} alt="" /> : <UserRound size={18} />}
        </span>
        <span>{userName || 'Account'}</span>
      </div>
    </header>
  )
}
