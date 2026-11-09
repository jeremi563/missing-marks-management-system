
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  Users,
  Settings,
} from 'lucide-react'

export const navigation = {
  student: [
    { label: 'Dashboard', to: '/student', icon: LayoutDashboard, end: true },
    { label: 'My Reports', to: '/student/reports', icon: FileText },
    { label: 'Attendance', to: '/student/attendance', icon: ClipboardList },
    { label: 'Notifications', to: '/student/notifications', icon: Users },
  ],

  lecturer: [
    { label: 'Dashboard', to: '/lecturer', icon: LayoutDashboard, end: true },
    { label: 'Assigned Reports', to: '/lecturer/reports', icon: FileText },
    { label: 'Attendance', to: '/lecturer/attendance', icon: ClipboardList },
    { label: 'Special Cases', to: '/lecturer/special-cases', icon: Users },
  ],

  cod: [
    { label: 'Dashboard', to: '/cod', icon: LayoutDashboard, end: true },
    { label: 'Reports', to: '/cod/reports', icon: FileText },
    { label: 'Appeals', to: '/cod/appeals', icon: ClipboardList },
    { label: 'Special Cases', to: '/cod/special-cases', icon: Users },
  ],

  admin: [
    { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
    { label: 'Users', to: '/admin/users', icon: Users },
    { label: 'Course Units', to: '/admin/course-units', icon: FileText },
    { label: 'Settings', to: '/admin/settings', icon: Settings },
  ],
}