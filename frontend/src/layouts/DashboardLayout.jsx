import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import Sidebar from '../components/navigation/Sidebar'
import Topbar from '../components/navigation/Topbar'
import '../styles/StudentPortal.css'
import '../styles/DesignSystem.css'

export default function DashboardLayout({ roleLabel, title, navigationItems }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()
  const { pathname } = useLocation()
  const userName = user?.displayName || user?.fullName || user?.name || user?.email
  const currentPage = navigationItems
    .filter(({ to, end }) => pathname === to || (!end && pathname.startsWith(`${to}/`)))
    .sort((first, second) => second.to.length - first.to.length)[0]
  const pageTitle = currentPage?.label || title

  return (
    <div className={`dashboard-layout portal-${roleLabel.toLowerCase()} ${roleLabel === 'Student' ? 'student-portal' : ''}`}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} navigationItems={navigationItems} roleLabel={roleLabel} />
      <div className="dashboard-main">
        <Topbar title={pageTitle} userName={userName} avatarData={user?.avatarData} onMenuClick={() => setSidebarOpen(true)} />
        <main className="dashboard-content"><Outlet /></main>
      </div>
    </div>
  )
}
