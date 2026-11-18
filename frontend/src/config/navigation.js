import {
  Building2, LayoutDashboard, FileText, ClipboardList, Users, Settings, Bell, UserRound, UserCheck, GraduationCap, UserPlus, BookOpen, UserRoundSearch, BookOpenCheck, FileSpreadsheet,
} from 'lucide-react'

export const navigation = {
  student: [
    { label: 'Dashboard', to: '/student', icon: LayoutDashboard, end: true },
    {
      label: 'Academics',
      icon: BookOpen,
      items: [
        { label: 'My marks', to: '/student/marks', icon: FileSpreadsheet },
        { label: 'Course enrollment', to: '/student/enrollments', icon: BookOpenCheck },
      ],
    },
    {
      label: 'Attendance & exams',
      icon: ClipboardList,
      items: [
        { label: 'Attendance', to: '/student/attendance', icon: ClipboardList },
        { label: 'Exam booklet verification', to: '/student/exam-booklets', icon: ClipboardList },
      ],
    },
    {
      label: 'Reports',
      icon: FileText,
      items: [
        { label: 'My reports', to: '/student/reports', icon: FileText },
      ],
    },
    {
      label: 'Requests & cases',
      icon: ClipboardList,
      items: [
        { label: 'Appeals', to: '/student/appeals', icon: ClipboardList },
        { label: 'Special cases', to: '/student/special-cases', icon: FileText },
      ],
    },
    {
      label: 'Account',
      icon: UserRound,
      items: [
        { label: 'Notifications', to: '/student/notifications', icon: Bell },
        { label: 'Profile', to: '/student/profile', icon: UserRound },
        { label: 'Settings', to: '/student/settings', icon: Settings },
      ],
    },
  ],
  lecturer: [
    { label: 'Dashboard', to: '/lecturer', icon: LayoutDashboard, end: true },
    {
      label: 'Teaching',
      icon: BookOpen,
      items: [
        { label: 'My course units', to: '/lecturer/course-units', icon: BookOpen },
        { label: 'My students', to: '/lecturer/students', icon: UserRoundSearch },
        { label: 'Attendance', to: '/lecturer/attendance', icon: ClipboardList },
        { label: 'Attendance lists', to: '/lecturer/attendance-lists', icon: ClipboardList },
      ],
    },
    {
      label: 'Assessment',
      icon: FileSpreadsheet,
      items: [
        { label: 'Assessment marks', to: '/lecturer/marks', icon: FileSpreadsheet },
        { label: 'CAT submissions', to: '/lecturer/cat-submissions', icon: ClipboardList },
        { label: 'Exam attendance review', to: '/lecturer/exam-attendance', icon: ClipboardList },
        { label: 'Exam booklet verification', to: '/lecturer/exam-booklets', icon: ClipboardList },
      ],
    },
    {
      label: 'Requests & reviews',
      icon: FileText,
      items: [
        { label: 'Enrollment requests', to: '/lecturer/enrollment-requests', icon: UserCheck },
        { label: 'Assigned reports', to: '/lecturer/reports', icon: FileText },
        { label: 'Special cases', to: '/lecturer/special-cases', icon: Users },
      ],
    },
    {
      label: 'Account',
      icon: UserRound,
      items: [
        { label: 'Notifications', to: '/lecturer/notifications', icon: Bell },
        { label: 'Settings', to: '/lecturer/settings', icon: Settings },
      ],
    },
  ],
  cod: [
    { label: 'Dashboard', to: '/cod', icon: LayoutDashboard, end: true },
    {
      label: 'Department',
      icon: Building2,
      items: [
        { label: 'Department directory', to: '/cod/departments', icon: Building2 },
        { label: 'Unit Delegation', to: '/cod/course-unit-assignments', icon: UserPlus },
      ],
    },
    {
      label: 'Teaching',
      icon: BookOpen,
      items: [
        { label: 'My course units', to: '/cod/teaching/course-units', icon: BookOpen },
        { label: 'My students', to: '/cod/teaching/students', icon: UserRoundSearch },
        { label: 'Attendance', to: '/cod/teaching/attendance', icon: ClipboardList },
        { label: 'Attendance lists', to: '/cod/teaching/attendance-lists', icon: ClipboardList },
      ],
    },
    {
      label: 'Assessment',
      icon: FileSpreadsheet,
      items: [
        { label: 'Assessment marks', to: '/cod/assessment/marks', icon: FileSpreadsheet },
        { label: 'CAT submissions', to: '/cod/assessment/cat-submissions', icon: ClipboardList },
        { label: 'Exam attendance review', to: '/cod/assessment/exam-attendance', icon: ClipboardList },
        { label: 'Exam booklet verification', to: '/cod/assessment/exam-booklets', icon: ClipboardList },
      ],
    },
    {
      label: 'Lecturer tasks',
      icon: FileText,
      items: [
        { label: 'My enrollment requests', to: '/cod/lecturer/enrollment-requests', icon: UserCheck },
        { label: 'Assigned reports', to: '/cod/lecturer/reports', icon: FileText },
        { label: 'Lecturer special cases', to: '/cod/lecturer/special-cases', icon: Users },
      ],
    },
    {
      label: 'Approvals',
      icon: UserCheck,
      items: [
        { label: 'Enrollment requests', to: '/cod/enrollment-requests', icon: UserCheck },
        { label: 'Lecturer approvals', to: '/cod/lecturer-approvals', icon: UserCheck },
      ],
    },
    {
      label: 'Reports & marks',
      icon: FileSpreadsheet,
      items: [
        { label: 'Reports', to: '/cod/reports', icon: FileText },
        { label: 'Mark corrections', to: '/cod/mark-corrections', icon: FileSpreadsheet },
      ],
    },
    {
      label: 'Cases & attendance',
      icon: ClipboardList,
      items: [
        { label: 'Appeals', to: '/cod/appeals', icon: ClipboardList },
        { label: 'Attendance review', to: '/cod/attendance', icon: ClipboardList },
        { label: 'Special cases', to: '/cod/special-cases', icon: Users },
      ],
    },
    {
      label: 'Account',
      icon: UserRound,
      items: [
        { label: 'Notifications', to: '/cod/notifications', icon: Bell },
        { label: 'Settings', to: '/cod/settings', icon: Settings },
      ],
    },
  ],
  admin: [
    { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
    {
      label: 'Staff',
      icon: GraduationCap,
      items: [
        { label: 'Lecturer approvals', to: '/admin/approvals', icon: UserCheck },
        { label: 'Lecturers', to: '/admin/lecturers', icon: GraduationCap },
      ],
    },
    {
      label: 'Accounts',
      icon: Users,
      items: [
        { label: 'All accounts', to: '/admin/users', icon: Users },
        { label: 'Students', to: '/admin/students', icon: UserRound },
        { label: 'Roster import', to: '/admin/roster-import', icon: FileSpreadsheet },
      ],
    },
    {
      label: 'Academic',
      icon: ClipboardList,
      items: [
        { label: 'Academic setup', to: '/admin/academic', icon: ClipboardList },
      ],
    },
    {
      label: 'Oversight',
      icon: FileText,
      items: [
        { label: 'Report summaries', to: '/admin/reports', icon: FileText },
        { label: 'Audit logs', to: '/admin/audit-logs', icon: ClipboardList },
        { label: 'System settings', to: '/admin/settings', icon: Settings },
      ],
    },
    {
      label: 'Account',
      icon: UserRound,
      items: [
        { label: 'Account settings', to: '/admin/account-settings', icon: UserRound },
      ],
    },
  ],
}
