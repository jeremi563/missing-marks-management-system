import {
  Building2, LayoutDashboard, FileText, ClipboardList, Users, Settings, Bell, UserRound, UserCheck, GraduationCap, UserPlus, BookOpen, UserRoundSearch, BookOpenCheck, FileSpreadsheet,
} from 'lucide-react'

const matchesStudentReportHistory = (pathname) => pathname === '/student/reports'
  || (/^\/student\/reports\/[^/]+$/.test(pathname) && pathname !== '/student/reports/new')

export const navigation = {
  student: [
    { label: 'Dashboard', to: '/student', icon: LayoutDashboard, end: true },
    {
      label: 'My studies',
      icon: BookOpen,
      items: [
        { label: 'My marks', to: '/student/marks', icon: FileSpreadsheet },
        { label: 'Course enrollment requests', to: '/student/enrollments', icon: BookOpenCheck },
      ],
    },
    {
      label: 'Attendance & exams',
      icon: ClipboardList,
      items: [
        { label: 'Attendance history', to: '/student/attendance', icon: ClipboardList, end: true },
        { label: 'Check in to a session', to: '/student/attendance/check-in', icon: ClipboardList },
        { label: 'Exam booklet check-in', to: '/student/exam-booklets', icon: ClipboardList },
      ],
    },
    {
      label: 'Reports & support',
      icon: FileText,
      items: [
        { label: 'My missing-mark reports', to: '/student/reports', icon: FileText, end: true, matchesRoute: matchesStudentReportHistory },
        { label: 'Submit a report', to: '/student/reports/new', icon: FileText, end: true },
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
        { label: 'Enrolled students', to: '/lecturer/students', icon: UserRoundSearch },
        { label: 'Attendance sessions', to: '/lecturer/attendance', icon: ClipboardList },
        { label: 'Attendance records', to: '/lecturer/attendance-lists', icon: ClipboardList },
      ],
    },
    {
      label: 'Assessments',
      icon: FileSpreadsheet,
      items: [
        { label: 'Assessment marks', to: '/lecturer/marks', icon: FileSpreadsheet },
        { label: 'CAT attendance review', to: '/lecturer/cat-submissions', icon: ClipboardList },
        { label: 'Exam attendance review', to: '/lecturer/exam-attendance', icon: ClipboardList },
        { label: 'Exam booklet verification', to: '/lecturer/exam-booklets', icon: ClipboardList },
      ],
    },
    {
      label: 'Reviews & requests',
      icon: FileText,
      items: [
        { label: 'Course enrollment requests', to: '/lecturer/enrollment-requests', icon: UserCheck },
        { label: 'Assigned missing-mark reports', to: '/lecturer/reports', icon: FileText },
        { label: 'Special cases', to: '/lecturer/special-cases', icon: Users },
      ],
    },
    {
      label: 'Account',
      icon: UserRound,
      items: [
        { label: 'Notifications', to: '/lecturer/notifications', icon: Bell },
        { label: 'Account settings', to: '/lecturer/settings', icon: Settings },
      ],
    },
  ],
  cod: [
    { label: 'Dashboard', to: '/cod', icon: LayoutDashboard, end: true },
    {
      label: 'Department management',
      icon: Building2,
      items: [
        { label: 'Department directory', to: '/cod/departments', icon: Building2 },
        { label: 'Course-unit assignments', to: '/cod/course-unit-assignments', icon: UserPlus },
      ],
    },
    {
      label: 'Teaching oversight',
      icon: BookOpen,
      items: [
        { label: 'Course units', to: '/cod/teaching/course-units', icon: BookOpen },
        { label: 'Enrolled students', to: '/cod/teaching/students', icon: UserRoundSearch },
        { label: 'Attendance sessions', to: '/cod/teaching/attendance', icon: ClipboardList },
        { label: 'Attendance records', to: '/cod/teaching/attendance-lists', icon: ClipboardList },
      ],
    },
    {
      label: 'Assessment oversight',
      icon: FileSpreadsheet,
      items: [
        { label: 'Assessment marks', to: '/cod/assessment/marks', icon: FileSpreadsheet },
        { label: 'CAT attendance review', to: '/cod/assessment/cat-submissions', icon: ClipboardList },
        { label: 'Exam attendance review', to: '/cod/assessment/exam-attendance', icon: ClipboardList },
        { label: 'Exam booklet verification', to: '/cod/assessment/exam-booklets', icon: ClipboardList },
      ],
    },
    {
      label: 'Lecturer work',
      icon: FileText,
      items: [
        { label: 'Lecturer enrollment requests', to: '/cod/lecturer/enrollment-requests', icon: UserCheck },
        { label: 'Assigned missing-mark reports', to: '/cod/lecturer/reports', icon: FileText },
        { label: 'Lecturer special cases', to: '/cod/lecturer/special-cases', icon: Users },
      ],
    },
    {
      label: 'Enrollment & staff approvals',
      icon: UserCheck,
      items: [
        { label: 'Student enrollment requests', to: '/cod/enrollment-requests', icon: UserCheck },
        { label: 'Lecturer approvals', to: '/cod/lecturer-approvals', icon: UserCheck },
      ],
    },
    {
      label: 'Reports & corrections',
      icon: FileSpreadsheet,
      items: [
        { label: 'Missing-mark reports', to: '/cod/reports', icon: FileText },
        { label: 'Mark corrections', to: '/cod/mark-corrections', icon: FileSpreadsheet },
      ],
    },
    {
      label: 'Student support',
      icon: ClipboardList,
      items: [
        { label: 'Student appeals', to: '/cod/appeals', icon: ClipboardList },
        { label: 'Attendance review', to: '/cod/attendance', icon: ClipboardList },
        { label: 'Student special cases', to: '/cod/special-cases', icon: Users },
      ],
    },
    {
      label: 'Account',
      icon: UserRound,
      items: [
        { label: 'Notifications', to: '/cod/notifications', icon: Bell },
        { label: 'Account settings', to: '/cod/settings', icon: Settings },
      ],
    },
  ],
  admin: [
    { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
    {
      label: 'People & access',
      icon: Users,
      items: [
        { label: 'All accounts', to: '/admin/users', icon: Users },
        { label: 'Student accounts', to: '/admin/students', icon: UserRound },
        { label: 'Lecturer accounts', to: '/admin/lecturers', icon: GraduationCap },
        { label: 'Lecturer approvals', to: '/admin/approvals', icon: UserCheck },
        { label: 'Import student roster', to: '/admin/roster-import', icon: FileSpreadsheet },
      ],
    },
    { label: 'Academic setup', to: '/admin/academic', icon: ClipboardList },
    {
      label: 'Operations & oversight',
      icon: FileText,
      items: [
        { label: 'Missing-mark reports', to: '/admin/reports', icon: FileText },
        { label: 'Audit logs', to: '/admin/audit-logs', icon: ClipboardList },
        { label: 'System settings', to: '/admin/settings', icon: Settings },
      ],
    },
    { label: 'Account settings', to: '/admin/account-settings', icon: UserRound },
  ],
}
