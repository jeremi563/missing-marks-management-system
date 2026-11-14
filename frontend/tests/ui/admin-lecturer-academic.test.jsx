import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AdminAcademic from '../../src/features/admin/AdminAcademic'
import AdminUsers from '../../src/features/admin/AdminUsers'

vi.mock('../../src/api/admin', () => ({
  createAdminUser: vi.fn(),
  deleteAdminStudent: vi.fn(),
  getAdminAcademicPeriods: vi.fn(),
  getAdminClassrooms: vi.fn(),
  getAdminAssessments: vi.fn(),
  getAdminCourses: vi.fn(),
  getAdminCourseUnits: vi.fn(),
  getAdminDepartments: vi.fn(),
  getAdminEnrollments: vi.fn(),
  getAdminUsers: vi.fn(),
  setDepartmentCod: vi.fn(),
  updateAdminAcademicPeriod: vi.fn(),
  updateAdminCourseUnit: vi.fn(),
  updateAdminUser: vi.fn(),
}))

vi.mock('../../src/auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'admin-user' } }),
}))

vi.mock('../../src/features/admin/DepartmentManagement', () => ({
  default: () => null,
}))

vi.mock('../../src/features/admin/AcademicRecordCreateForm', () => ({
  default: () => <div>Create resource form</div>,
}))

import {
  deleteAdminStudent,
  getAdminAcademicPeriods,
  getAdminClassrooms,
  getAdminDepartments,
  getAdminEnrollments,
  getAdminUsers,
} from '../../src/api/admin'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('administrator lecturer and academic-period views', () => {
  it('uses department codes throughout the lecturer directory', async () => {
    getAdminUsers.mockResolvedValue({
      success: true,
      data: {
        users: [{
          id: 'lecturer-1',
          displayName: 'Alex Lecturer',
          email: 'alex@example.test',
          roles: ['lecturer', 'cod'],
          isActive: true,
          approvalStatus: 'APPROVED',
          departmentMemberships: [{ departmentId: 'department-1' }],
        }],
      },
    })
    getAdminDepartments.mockResolvedValue({
      success: true,
      data: {
        departments: [{
          id: 'department-1',
          name: 'Information Technology',
          code: 'IN',
          designatedCodUserId: 'lecturer-1',
        }],
      },
    })

    render(<AdminUsers roleFilter="lecturer" />)

    expect(await screen.findByRole('tab', { name: /IN/ })).toBeTruthy()
    expect(screen.queryByText('Information Technology')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: /All CODs/ }))
    expect(await screen.findByRole('cell', { name: 'IN' })).toBeTruthy()
  })

  it('shows the academic year for periods and leaves enrolment creation to lecturers', async () => {
    getAdminAcademicPeriods.mockResolvedValue({
      success: true,
      data: {
        items: [{
          id: 'period-1',
          name: 'Semester One',
          startsAt: '2026-08-31T00:00:00.000Z',
          code: 'S1',
        }],
      },
    })
    getAdminEnrollments.mockResolvedValue({
      success: true,
      data: { items: [] },
    })

    render(<AdminAcademic />)
    fireEvent.click(screen.getByRole('tab', { name: 'Academic periods' }))

    expect(await screen.findByRole('columnheader', { name: 'Academic year' })).toBeTruthy()
    expect(await screen.findByRole('cell', { name: '2026/27' })).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Enrolments' }))
    expect(await screen.findByText('Enrolments are created when lecturers approve students’ course-unit requests. Administrators can review these records here.')).toBeTruthy()
    expect(screen.queryByText('Create resource form')).toBeNull()
  })

  it('uses an in-app confirmation before deleting a student', async () => {
    getAdminUsers.mockResolvedValue({
      success: true,
      data: {
        users: [{
          id: 'student-1',
          displayName: 'Sam Student',
          email: 'sam@example.test',
          roles: ['student'],
          isActive: true,
          studentProfile: { studentNumber: 'IN/100/2026' },
        }],
      },
    })
    getAdminDepartments.mockResolvedValue({ success: true, data: { departments: [] } })
    deleteAdminStudent.mockResolvedValue({ success: true })

    render(<AdminUsers roleFilter="student" />)
    fireEvent.click(await screen.findByRole('button', { name: /Delete/ }))

    expect(await screen.findByRole('alertdialog', { name: 'Delete student account?' })).toBeTruthy()
    expect(deleteAdminStudent).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Delete student' }))

    expect(await screen.findByRole('status')).toBeTruthy()
    expect(deleteAdminStudent).toHaveBeenCalledWith('student-1')
  })

  it('lists administrator-configured classroom GPS settings', async () => {
    getAdminClassrooms.mockResolvedValue({
      success: true,
      data: {
        items: [{
          id: 'classroom-1',
          name: 'Block A, Room 12',
          latitude: -1.2864,
          longitude: 36.8172,
          boundaryMeters: 80,
          isActive: true,
        }],
      },
    })

    render(<AdminAcademic />)
    fireEvent.click(screen.getByRole('tab', { name: 'Classrooms' }))

    expect(await screen.findByRole('cell', { name: 'Block A, Room 12' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: '-1.2864' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: '36.8172' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: '80 m' })).toBeTruthy()
  })
})
