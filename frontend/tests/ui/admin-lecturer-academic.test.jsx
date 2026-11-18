import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AdminAcademic from '../../src/features/admin/AdminAcademic'
import AcademicYearScheduleForm from '../../src/features/admin/AcademicYearScheduleForm'
import AdminUsers from '../../src/features/admin/AdminUsers'

vi.mock('../../src/api/admin', () => ({
  createAdminUser: vi.fn(),
  deleteAdminStudent: vi.fn(),
  getAdminAcademicPeriods: vi.fn(),
  getAdminAssessments: vi.fn(),
  getAdminClassrooms: vi.fn(),
  getAdminCourses: vi.fn(),
  getAdminCourseUnits: vi.fn(),
  getAdminDepartments: vi.fn(),
  getAdminEnrollments: vi.fn(),
  getAdminUsers: vi.fn(),
  saveAdminAcademicYearSchedule: vi.fn(),
  setDepartmentCod: vi.fn(),
  updateAdminAcademicPeriod: vi.fn(),
  updateAdminClassroom: vi.fn(),
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
  getAdminAssessments,
  getAdminClassrooms,
  getAdminCourses,
  getAdminDepartments,
  getAdminEnrollments,
  getAdminUsers,
  saveAdminAcademicYearSchedule,
  updateAdminClassroom,
} from '../../src/api/admin'
import { academicYearForDate } from '../../src/shared/academic-year'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
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
    expect(screen.queryByRole('columnheader', { name: 'Academic period' })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Semester 3 courses' })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Code' })).toBeNull()
    expect(await screen.findByRole('cell', { name: '2025/26' })).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Enrolments' }))
    expect(await screen.findByText(/Enrolments are created when lecturers approve students’ course-unit requests/)).toBeTruthy()
    expect(screen.queryByText('Create resource form')).toBeNull()
  })

  it('displays and filters approved enrolments by academic year and semester', async () => {
    getAdminAcademicPeriods.mockResolvedValue({
      success: true,
      data: {
        items: [
          { id: 'period-1', name: 'Semester One', academicYear: '2026/27', semester: 1 },
          { id: 'period-2', name: 'Semester Two', academicYear: '2026/27', semester: 2 },
        ],
      },
    })
    getAdminEnrollments.mockResolvedValue({
      success: true,
      data: {
        items: [{
          id: 'enrollment-1',
          createdAt: '2026-09-10T00:00:00.000Z',
          student: { studentNumber: 'IN16/00001/26', user: { displayName: 'Sam Student' } },
          courseUnit: { code: 'IN101', name: 'Computing' },
          academicPeriod: { id: 'period-1', name: 'Semester One', academicYear: '2026/27', semester: 1 },
        }],
      },
    })

    render(<AdminAcademic />)
    fireEvent.click(screen.getByRole('tab', { name: 'Enrolments' }))

    expect(await screen.findByRole('columnheader', { name: 'Academic year' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: '2026/27' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'Semester 1' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'IN101 — Computing' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Filter by academic year and semester'), { target: { value: 'period-1' } })
    await waitFor(() => {
      expect(getAdminEnrollments).toHaveBeenLastCalledWith({
        page: 1,
        limit: 100,
        academicPeriodId: 'period-1',
      })
    })
    expect(screen.getByRole('option', { name: '2026/27 · Semester 2 · Semester Two' })).toBeTruthy()
  })

  it('opens the academic-period editor as an interactive modal dialog', async () => {
    getAdminCourses.mockResolvedValue({ success: true, data: { courses: [] } })
    getAdminAcademicPeriods.mockResolvedValue({
      success: true,
      data: {
        items: [{
          id: 'period-1',
          name: 'Semester One',
          code: 'S1',
          enrollmentOpensAt: null,
          enrollmentClosesAt: null,
        }],
      },
    })

    render(<AdminAcademic />)
    fireEvent.click(screen.getByRole('tab', { name: 'Academic periods' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Edit enrollment window' }))

    const dialog = await screen.findByRole('dialog', { name: 'Edit enrollment window' })
    expect(dialog.open).toBe(true)
    fireEvent.change(screen.getByLabelText('Period name'), { target: { value: 'Semester Two' } })
    expect(screen.getByLabelText('Period name').value).toBe('Semester Two')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog', { name: 'Edit enrollment window' })).toBeNull()
  })

  it('shows whether each configured assessment is a CAT or an exam', async () => {
    getAdminAssessments.mockResolvedValue({
      success: true,
      data: {
        items: [
          { id: 'assessment-cat', name: 'CAT 1', type: 'CAT', courseUnit: { code: 'IN101', name: 'Computing' } },
          { id: 'assessment-exam', name: 'Final exam', type: 'EXAM', courseUnit: { code: 'IN101', name: 'Computing' } },
        ],
      },
    })

    render(<AdminAcademic />)
    fireEvent.click(screen.getByRole('tab', { name: 'Assessments' }))

    expect(await screen.findByRole('columnheader', { name: 'Assessment type' })).toBeTruthy()
    expect(await screen.findByRole('cell', { name: 'CAT' })).toBeTruthy()
    expect(await screen.findByRole('cell', { name: 'Exam' })).toBeTruthy()
  })

  it('automatically selects the current academic year and only allows semester 1 setup', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-18T12:00:00+03:00'))
    const academicYear = academicYearForDate(new Date())
    getAdminAcademicPeriods.mockResolvedValue({ success: true, data: { items: [] } })
    getAdminCourses.mockResolvedValue({
      success: true,
      data: { courses: [{ id: 'course-1', code: '16', name: 'Computing', department: { code: 'IN' } }] },
    })
    saveAdminAcademicYearSchedule.mockResolvedValue({ success: true })
    const onSaved = vi.fn()

    render(<AcademicYearScheduleForm onSaved={onSaved} />)

    expect(await screen.findByLabelText('Starts', { selector: '#semester-1-start' })).toBeTruthy()
    expect(screen.getByText(academicYear)).toBeTruthy()
    expect(screen.queryByLabelText('Academic year')).toBeNull()
    expect(screen.queryByLabelText('Starts', { selector: '#semester-2-start' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save semester 1' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
    expect(saveAdminAcademicYearSchedule).toHaveBeenCalledWith(academicYear, expect.objectContaining({
      semester: 1,
      schedule: expect.objectContaining({ startsAt: expect.any(String), endsAt: expect.any(String) }),
    }))
  })

  it('only exposes semester 2 after semester 1 has ended', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-12-21T09:00:00+03:00'))
    getAdminAcademicPeriods.mockResolvedValue({
      success: true,
      data: {
        items: [{
          id: 'semester-1',
          name: 'Semester 1 2026/27',
          academicYear: '2026/27',
          semester: 1,
          startsAt: '2026-08-31T21:00:00.000Z',
          endsAt: '2026-12-20T20:59:59.999Z',
          enrollmentOpensAt: null,
          enrollmentClosesAt: null,
        }],
      },
    })
    getAdminCourses.mockResolvedValue({ success: true, data: { courses: [] } })

    render(<AcademicYearScheduleForm onSaved={vi.fn()} />)

    expect(await screen.findByLabelText('Starts', { selector: '#semester-2-start' })).toBeTruthy()
    expect(screen.queryByLabelText('Starts', { selector: '#semester-1-start' })).toBeNull()
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

  it('lets administrators update classroom name, coordinates, and GPS boundary', async () => {
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
    updateAdminClassroom.mockResolvedValue({ success: true })

    render(<AdminAcademic />)
    fireEvent.click(screen.getByRole('tab', { name: 'Classrooms' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Edit classroom' }))

    const dialog = await screen.findByRole('dialog', { name: 'Edit classroom' })
    expect(dialog.open).toBe(true)
    fireEvent.change(screen.getByLabelText('Classroom name'), { target: { value: 'North Wing Lab' } })
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '-1.287' } })
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '36.818' } })
    fireEvent.change(screen.getByLabelText('GPS boundary (metres)'), { target: { value: '120' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save classroom' }))

    expect(await screen.findByText('Classroom name and GPS settings updated.')).toBeTruthy()
    expect(updateAdminClassroom).toHaveBeenCalledWith('classroom-1', {
      name: 'North Wing Lab',
      latitude: -1.287,
      longitude: 36.818,
      boundaryMeters: 120,
    })
  })
})
