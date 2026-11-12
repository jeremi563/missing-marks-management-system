
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import LecturerDepartmentRegistration from './pages/LecturerDepartmentRegistration'
import EmailVerificationPage from './pages/EmailVerificationPage'
import NotFound from './pages/NotFound'
import AccessDenied from './pages/AccessDenied'

import DashboardLayout from './layouts/DashboardLayout'
import DashboardHome from './features/shared/DashboardHome'
import AccountSettings from './features/shared/AccountSettings'

import RequireRole from './auth/RequireRole'
import { navigation } from './config/navigation'
import StudentDashboard from './features/student/StudentDashboard'
import StudentReports from './features/student/StudentReports'
import StudentReportDetails from './features/student/StudentReportDetails'
import StudentAppeals from './features/student/StudentAppeals'
import StudentAttendance from './features/student/StudentAttendance'
import StudentNotifications from './features/student/StudentNotifications'
import StudentProfile from './features/student/StudentProfile'
import StudentReportCreate from './features/student/StudentReportCreate'
import LecturerReports from './features/lecturer/LecturerReports'
import LecturerCourseUnits from './features/lecturer/LecturerCourseUnits'
import LecturerStudents from './features/lecturer/LecturerStudents'
import LecturerAttendance from './features/lecturer/LecturerAttendance'
import LecturerSpecialCases from './features/lecturer/LecturerSpecialCases'
import CodReports from './features/cod/CodReports'
import CodAppeals from './features/cod/CodAppeals'
import CodAttendance from './features/cod/CodAttendance'
import CodSpecialCases from './features/cod/CodSpecialCases'
import CodDepartmentWorkspace from './features/cod/CodDepartmentWorkspace'
import CodCourseUnitAssignments from './features/cod/CodCourseUnitAssignments'
import CodApprovals from './features/cod/CodApprovals'
import AdminUsers from './features/admin/AdminUsers'
import AdminApprovals from './features/admin/AdminApprovals'
import AdminAcademic from './features/admin/AdminAcademic'
import AdminSettings from './features/admin/AdminSettings'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/lecturer-department-registration" element={<LecturerDepartmentRegistration />} />
        <Route path="/verify-email" element={<EmailVerificationPage />} />
        <Route path="/403" element={<AccessDenied />} />
        <Route element={<RequireRole allowedRoles={['student']} />}>
          <Route
            path="/student"
            element={
              <DashboardLayout
                roleLabel="Student"
                title="Student Dashboard"
                navigationItems={navigation.student}
              />
            }
          >
            <Route
              index
              element={<StudentDashboard />}
            />
            <Route path="reports" element={<StudentReports />} />
            <Route path="reports/new" element={<StudentReportCreate />} />
            <Route
              path="reports/:reportId"
              element={<StudentReportDetails />}
            />
            <Route path="appeals" element={<StudentAppeals />} />
            <Route path="attendance" element={<StudentAttendance />} />
            <Route path="notifications" element={<StudentNotifications />} />
            <Route path="profile" element={<StudentProfile />} />
            <Route path="settings" element={<AccountSettings roleLabel="Student" />} />
          </Route>
        </Route>

        {/* Lecturer portal */}
        <Route element={<RequireRole allowedRoles={['lecturer']} />}>
          <Route
            path="/lecturer"
            element={
              <DashboardLayout
                roleLabel="Lecturer"
                title="Lecturer Dashboard"
                navigationItems={navigation.lecturer}
              />
            }
          >
            <Route
              index
              element={<DashboardHome roleLabel="Lecturer" />}
            />
            <Route path="course-units" element={<LecturerCourseUnits />} />
            <Route path="students" element={<LecturerStudents />} />
            <Route path="reports" element={<LecturerReports />} />
            <Route path="attendance" element={<LecturerAttendance />} />
            <Route path="special-cases" element={<LecturerSpecialCases />} />
            <Route path="settings" element={<AccountSettings roleLabel="Lecturer" />} />
          </Route>
        </Route>

        {/* COD portal */}
        <Route element={<RequireRole allowedRoles={['cod']} />}>
          <Route
            path="/cod"
            element={
              <DashboardLayout
                roleLabel="COD"
                title="COD Dashboard"
                navigationItems={navigation.cod}
              />
            }
          >
            <Route
              index
              element={<DashboardHome roleLabel="COD" />}
            />
            <Route path="departments" element={<CodDepartmentWorkspace />} />
            <Route path="course-unit-assignments" element={<CodCourseUnitAssignments />} />
            <Route path="lecturer-approvals" element={<CodApprovals />} />
            <Route path="reports" element={<CodReports />} />
            <Route path="appeals" element={<CodAppeals />} />
            <Route path="attendance" element={<CodAttendance />} />
            <Route path="special-cases" element={<CodSpecialCases />} />
            <Route path="settings" element={<AccountSettings roleLabel="COD" />} />
          </Route>
        </Route>

        {/* Administrator portal */}
        <Route element={<RequireRole allowedRoles={['administrator']} />}>
          <Route
            path="/admin"
            element={
              <DashboardLayout
                roleLabel="Administrator"
                title="Admin Dashboard"
                navigationItems={navigation.admin}
              />
            }
          >
            <Route
              index
              element={<DashboardHome roleLabel="Administrator" />}
            />
            <Route path="approvals" element={<AdminApprovals />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="students" element={<AdminUsers roleFilter="student" />} />
            <Route path="lecturers" element={<AdminUsers roleFilter="lecturer" />} />
            <Route path="academic" element={<AdminAcademic />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="account-settings" element={<AccountSettings roleLabel="Administrator" />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App