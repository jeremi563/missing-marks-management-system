import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../../src/auth/AuthContext'
import { navigation } from '../../src/config/navigation'
import DashboardLayout from '../../src/layouts/DashboardLayout'

afterEach(cleanup)

describe('Student DashboardLayout', () => {
  it('shows only the first name beside the profile picture', () => {
    render(
      <AuthContext.Provider value={{ user: { displayName: 'Taylor Student' } }}>
        <MemoryRouter initialEntries={['/student']}>
          <Routes>
            <Route
              path="/student"
              element={
                <DashboardLayout
                  roleLabel="Student"
                  title="Student Dashboard"
                  navigationItems={[
                    { label: 'Dashboard', to: '/student', end: true },
                    { label: 'Reports', to: '/student/reports' },
                  ]}
                />
              }
            >
              <Route index element={<p>Dashboard content</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    expect(screen.getByText('Taylor')).toBeTruthy()
    expect(screen.queryByText('Taylor Student')).toBeNull()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Reports' })).toBeTruthy()
  })

  it('groups links in collapsible sections and opens the active section', () => {
    const navigationItems = [
      { label: 'Dashboard', to: '/student', end: true },
      {
        label: 'Reports & support',
        items: [
          { label: 'My reports', to: '/student/reports' },
          { label: 'Appeals', to: '/student/appeals' },
        ],
      },
    ]

    render(
      <AuthContext.Provider value={{ user: { displayName: 'Taylor Student' } }}>
        <MemoryRouter initialEntries={['/student/reports']}>
          <Routes>
            <Route
              path="/student"
              element={<DashboardLayout roleLabel="Student" title="Student Dashboard" navigationItems={navigationItems} />}
            >
              <Route index element={<p>Dashboard content</p>} />
              <Route path="reports" element={<p>Reports content</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    const group = screen.getByRole('button', { name: 'Reports & support' })
    expect(group.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('link', { name: 'My reports' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'My reports' })).toBeTruthy()

    fireEvent.click(group)
    expect(group.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('link', { name: 'My reports' })).toBeNull()
  })

  it('keeps report history active on detail pages without activating report submission', () => {
    render(
      <AuthContext.Provider value={{ user: { displayName: 'Taylor Student' } }}>
        <MemoryRouter initialEntries={['/student/reports/report-123']}>
          <Routes>
            <Route
              path="/student"
              element={<DashboardLayout roleLabel="Student" title="Student Dashboard" navigationItems={navigation.student} />}
            >
              <Route path="reports/:reportId" element={<p>Report details</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )

    const reportHistory = screen.getByRole('link', { name: 'My missing-mark reports' })
    const reportSubmission = screen.getByRole('link', { name: 'Submit a report' })
    expect(reportHistory.className).toContain('active')
    expect(reportSubmission.className).not.toContain('active')
    expect(screen.getByRole('heading', { name: 'My missing-mark reports' })).toBeTruthy()
  })

  it('groups related pages and keeps single-page destinations direct', () => {
    for (const [role, items] of Object.entries(navigation)) {
      expect(items[0].to).toBe(`/${role}`)
      expect(items[0].label).toBe('Dashboard')
      expect(items.slice(1).filter(({ items: groupItems }) => groupItems).every(({ items: groupItems }) => groupItems.length > 1)).toBe(true)
    }
    expect(navigation.admin.slice(1).map(({ label }) => label)).toEqual([
      'People & access',
      'Academic setup',
      'Operations & oversight',
      'Account settings',
    ])
    expect(navigation.admin.filter(({ items }) => !items).slice(1).map(({ to }) => to)).toEqual([
      '/admin/academic',
      '/admin/account-settings',
    ])
    expect(navigation.student.slice(1).map(({ label }) => label)).toEqual([
      'My studies',
      'Attendance & exams',
      'Reports & support',
      'Account',
    ])
    expect(navigation.lecturer.slice(1).map(({ label }) => label)).toEqual([
      'Teaching',
      'Assessments',
      'Reviews & requests',
      'Account',
    ])
    expect(navigation.lecturer.slice(1, 3).flatMap(({ items }) => items.map(({ to }) => to))).toEqual([
      '/lecturer/course-units',
      '/lecturer/students',
      '/lecturer/attendance',
      '/lecturer/attendance-lists',
      '/lecturer/marks',
      '/lecturer/cat-submissions',
      '/lecturer/exam-attendance',
      '/lecturer/exam-booklets',
    ])
    expect(navigation.cod.slice(1).map(({ label }) => label)).toEqual([
      'Department management',
      'Teaching oversight',
      'Assessment oversight',
      'Lecturer work',
      'Enrollment & staff approvals',
      'Reports & corrections',
      'Student support',
      'Account',
    ])
    expect(navigation.student.flatMap(({ items }) => items || []).map(({ to }) => to)).toContain('/student/attendance/check-in')
    expect(navigation.student.flatMap(({ items }) => items || []).map(({ to }) => to)).toContain('/student/reports/new')
    expect(navigation.cod.slice(1, 4).flatMap(({ items }) => items.map(({ to }) => to))).toEqual([
      '/cod/departments',
      '/cod/course-unit-assignments',
      '/cod/teaching/course-units',
      '/cod/teaching/students',
      '/cod/teaching/attendance',
      '/cod/teaching/attendance-lists',
      '/cod/assessment/marks',
      '/cod/assessment/cat-submissions',
      '/cod/assessment/exam-attendance',
      '/cod/assessment/exam-booklets',
    ])
    expect(navigation.cod.slice(4, 8).flatMap(({ items }) => items.map(({ to }) => to))).toEqual([
      '/cod/lecturer/enrollment-requests',
      '/cod/lecturer/reports',
      '/cod/lecturer/special-cases',
      '/cod/enrollment-requests',
      '/cod/lecturer-approvals',
      '/cod/reports',
      '/cod/mark-corrections',
      '/cod/appeals',
      '/cod/attendance',
      '/cod/special-cases',
    ])
  })
})
