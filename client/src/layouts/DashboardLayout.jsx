import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/navigation/Sidebar'
import Topbar from '../components/navigation/Topbar'
import './DashboardLayout.css'

function DashboardLayout({
  roleLabel = 'User',
  title = 'Dashboard',
  userName = 'User',
  navigationItems = [],
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="dashboard-layout">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigationItems={navigationItems}
        roleLabel={roleLabel}
      />

      <div className="dashboard-main">
        <Topbar
          title={title}
          userName={userName}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout