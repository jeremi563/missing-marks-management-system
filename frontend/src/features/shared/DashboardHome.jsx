import {
  ArrowRight, Bell, BookOpenCheck, ClipboardCheck, FileCheck2, FileText, GraduationCap, Settings2, ShieldCheck, UserCheck, Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'

const dashboards = {
  Student: {
    eyebrow: 'STUDENT PORTAL',
    heading: 'Your academic support, all in one place.',
    description: 'Submit a missing-mark report and follow every update from your personal workspace.',
    cards: [
      { title: 'Create a report', detail: 'Tell us about a missing assessment mark.', to: '/student/reports/new', icon: FileText, accent: 'teal' },
      { title: 'Track your reports', detail: 'Review status and updates on your cases.', to: '/student/reports', icon: ClipboardCheck, accent: 'blue' },
      { title: 'Check attendance', detail: 'View your CAT, exam, and class attendance.', to: '/student/attendance', icon: BookOpenCheck, accent: 'gold' },
    ],
  },
  Lecturer: {
    eyebrow: 'LECTURER PORTAL',
    heading: 'Your review workspace.',
    description: 'Manage assigned reports and academic records with a clear view of your next steps.',
    cards: [
      { title: 'Assigned reports', detail: 'Review student cases assigned to you.', to: '/lecturer/reports', icon: FileCheck2, accent: 'teal' },
      { title: 'Attendance', detail: 'Manage assessment attendance records.', to: '/lecturer/attendance', icon: BookOpenCheck, accent: 'blue' },
      { title: 'Special cases', detail: 'Review and respond to special cases.', to: '/lecturer/special-cases', icon: Users, accent: 'gold' },
    ],
  },
  COD: {
    eyebrow: 'ACADEMIC OFFICER PORTAL',
    heading: 'A clear view of your department.',
    description: 'Coordinate report reviews, appeals, and academic follow-up from one workspace.',
    cards: [
      { title: 'Lecturer approvals', detail: 'Review lecturer applications for your designated department.', to: '/cod/lecturer-approvals', icon: UserCheck, accent: 'teal' },
      { title: 'Department reports', detail: 'Review and assign department cases.', to: '/cod/reports', icon: FileText, accent: 'teal' },
      { title: 'Appeals', detail: 'Review decisions escalated for your attention.', to: '/cod/appeals', icon: ShieldCheck, accent: 'blue' },
      { title: 'Attendance review', detail: 'Review attendance-related records.', to: '/cod/attendance', icon: BookOpenCheck, accent: 'gold' },
    ],
  },
  Administrator: {
    eyebrow: 'ADMINISTRATOR PORTAL',
    heading: 'Keep the academic support system moving.',
    description: 'Manage access, academic setup, and oversight from your administration workspace.',
    cards: [
      { title: 'Lecturer approvals', detail: 'Review department-registered lecturer applications.', to: '/admin/approvals', icon: GraduationCap, accent: 'teal' },
      { title: 'Account directory', detail: 'Manage student, lecturer, and staff access.', to: '/admin/users', icon: Users, accent: 'blue' },
      { title: 'Academic setup', detail: 'Maintain the academic structure.', to: '/admin/academic', icon: Settings2, accent: 'gold' },
    ],
  },
}

const roleLabels = {
  administrator: 'System Admin',
  cod: 'COD',
  lecturer: 'Lecturer',
  student: 'Student',
}
const roleOrder = ['administrator', 'cod', 'lecturer', 'student']

export default function DashboardHome({ roleLabel }) {
  const dashboard = dashboards[roleLabel] || dashboards.Student
  const { user } = useAuth()
  const assignedRoles = Array.isArray(user?.roles) ? user.roles : [user?.role].filter(Boolean)
  const visibleRoles = roleOrder
    .filter((role) => assignedRoles.includes(role))
    .map((role) => roleLabels[role])
  if (!visibleRoles.length) visibleRoles.push(roleLabels[roleLabel.toLowerCase()] || roleLabel)
  const memberDepartments = user?.departmentMemberships?.map(({ department }) => department).filter(Boolean) || []
  const designatedDepartments = user?.designatedDepartments || []
  const departments = roleLabel === 'COD'
    ? designatedDepartments.length ? designatedDepartments : memberDepartments
    : memberDepartments

  return (
    <section className="portal-home">
      <header className="portal-welcome">
        <div className="portal-welcome-copy">
          <div className="portal-role-badges" role="group" aria-label="Account roles">
            {visibleRoles.map((role) => <span className="portal-role-badge" key={role}>{role}</span>)}
          </div>
          <p className="eyebrow">{dashboard.eyebrow}</p>
          <h2>{dashboard.heading}</h2>
          <p>{dashboard.description}</p>
        </div>
        <div className="portal-welcome-art" aria-hidden="true">
          <span className="welcome-orbit welcome-orbit-one" />
          <span className="welcome-orbit welcome-orbit-two" />
          <span className="welcome-emblem"><GraduationCap size={30} /></span>
        </div>
      </header>
      {(roleLabel === 'Lecturer' || roleLabel === 'COD') && (
        <section className="portal-departments" aria-labelledby="dashboard-departments-heading">
          <div>
            <p className="eyebrow">YOUR DEPARTMENTS</p>
            <h3 id="dashboard-departments-heading">Department affiliations</h3>
          </div>
          {departments.length ? (
            <ul>
              {departments.map((department) => (
                <li key={department.id}>
                  <strong>{department.name}</strong>
                  {department.code && <span>{department.code}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="portal-departments-empty">No departments are currently linked to your account.</p>}
        </section>
      )}
      <div className="portal-home-heading">
        <div><h3>Your workspace</h3><p>Choose an area to continue.</p></div>
        <Link to={roleLabel === 'Administrator' ? '/admin/account-settings' : `/${roleLabel === 'COD' ? 'cod' : roleLabel.toLowerCase()}/settings`}>
          <Settings2 size={16} /> Account settings
        </Link>
      </div>
      <div className="portal-shortcut-grid">
        {dashboard.cards.map(({ title, detail, to, icon: Icon, accent }) => (
          <Link className="portal-shortcut-card" to={to} key={title}>
            <span className={`shortcut-icon shortcut-${accent}`}><Icon size={20} /></span>
            <span className="shortcut-copy"><strong>{title}</strong><small>{detail}</small></span>
            <ArrowRight className="shortcut-arrow" size={18} />
          </Link>
        ))}
      </div>
      <div className="portal-note"><ShieldCheck size={18} /><p><strong>Your workspace is role-based.</strong> Information and actions are available according to your assigned access.</p><Bell size={17} /></div>
    </section>
  )
}
