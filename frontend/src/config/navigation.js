import {
  Building2, LayoutDashboard, FileText, ClipboardList, Users, Settings, Bell, UserRound, UserCheck, GraduationCap, UserPlus, BookOpen, UserRoundSearch,
} from 'lucide-react'

export const navigation = {
  student: [
    { label: 'Dashboard', to: '/student', icon: LayoutDashboard, end: true },
    { label: 'My reports', to: '/student/reports', icon: FileText },
    { label: 'Appeals', to: '/student/appeals', icon: ClipboardList },
    { label: 'Attendance', to: '/student/attendance', icon: ClipboardList },
    { label: 'Notifications', to: '/student/notifications', icon: Bell },
    { label: 'Profile', to: '/student/profile', icon: UserRound },
    { label: 'Settings', to: '/student/settings', icon: Settings },
  ],
  lecturer: [
    { label: 'Dashboard', to: '/lecturer', icon: LayoutDashboard, end: true },
    { label: 'My course units', to: '/lecturer/course-units', icon: BookOpen },
    { label: 'My students', to: '/lecturer/students', icon: UserRoundSearch },
    { label: 'Assigned reports', to: '/lecturer/reports', icon: FileText },
    { label: 'Attendance', to: '/lecturer/attendance', icon: ClipboardList },
    { label: 'Special cases', to: '/lecturer/special-cases', icon: Users },
    { label: 'Settings', to: '/lecturer/settings', icon: Settings },
  ],
  cod: [
    { label: 'Dashboard', to: '/cod', icon: LayoutDashboard, end: true },
    { label: 'Department workspace', to: '/cod/departments', icon: Building2 },
    { label: 'Unit Delegation', to: '/cod/course-unit-assignments', icon: UserPlus },
    { label: 'Lecturer approvals', to: '/cod/lecturer-approvals', icon: UserCheck },
    { label: 'Reports', to: '/cod/reports', icon: FileText },
    { label: 'Appeals', to: '/cod/appeals', icon: ClipboardList },
    { label: 'Attendance review', to: '/cod/attendance', icon: ClipboardList },
    { label: 'Special cases', to: '/cod/special-cases', icon: Users },
    { label: 'Settings', to: '/cod/settings', icon: Settings },
  ],
  admin: [
    { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
    { label: 'Lecturer approvals', to: '/admin/approvals', icon: UserCheck },
    { label: 'All accounts', to: '/admin/users', icon: Users },
    { label: 'Students', to: '/admin/students', icon: UserRound },
    { label: 'Lecturers', to: '/admin/lecturers', icon: GraduationCap },
    { label: 'Academic setup', to: '/admin/academic', icon: ClipboardList },
    { label: 'System settings', to: '/admin/settings', icon: Settings },
    { label: 'Account settings', to: '/admin/account-settings', icon: UserRound },
  ],
}
