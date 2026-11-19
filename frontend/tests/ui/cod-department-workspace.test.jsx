import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CodDepartmentWorkspace from '../../src/features/cod/CodDepartmentWorkspace'

vi.mock('../../src/api/cod', () => ({
  getCodDepartmentCourseUnits: vi.fn(),
  getCodDepartmentLecturers: vi.fn(),
  getCodDepartmentStudents: vi.fn(),
  getCodDepartments: vi.fn(),
}))

import {
  getCodDepartmentCourseUnits,
  getCodDepartmentLecturers,
  getCodDepartmentStudents,
  getCodDepartments,
} from '../../src/api/cod'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('CodDepartmentWorkspace', () => {
  it('opens on the department student directory and lists lecturers in the same page', async () => {
    getCodDepartments.mockResolvedValue({
      success: true,
      data: [{ id: 'department-in', name: 'Information Technology', code: 'IN' }],
    })
    getCodDepartmentStudents.mockResolvedValue({
      success: true,
      data: {
        items: [{
          id: 'student-in',
          studentNumber: 'IN16/12345/26',
          officialEmail: 'student@example.test',
          user: { displayName: 'Student One', isActive: true },
        }],
        pagination: { page: 1, totalPages: 1, total: 1 },
      },
    })
    getCodDepartmentLecturers.mockResolvedValue({
      success: true,
      data: {
        items: [{
          id: 'lecturer-in',
          displayName: 'Lecturer One',
          email: 'lecturer@example.test',
          lecturerProfile: { staffNumber: 'IN/1234/lecturer' },
        }],
        pagination: { page: 1, totalPages: 1, total: 1 },
      },
    })

    render(<CodDepartmentWorkspace />)

    expect(await screen.findByText('Student One')).toBeTruthy()
    expect(screen.getByText('IN16/12345/26')).toBeTruthy()
    expect(getCodDepartmentStudents).toHaveBeenCalledWith({
      departmentId: 'department-in',
      page: 1,
      limit: 20,
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Lecturers' }))
    expect(await screen.findByText('Lecturer One')).toBeTruthy()
    expect(screen.getByText('IN/1234/lecturer')).toBeTruthy()
    expect(getCodDepartmentLecturers).toHaveBeenCalledWith({
      departmentId: 'department-in',
      page: 1,
      limit: 20,
    })
  })

  it('groups course-unit codes under their course and does not display unit names', async () => {
    getCodDepartments.mockResolvedValue({
      success: true,
      data: [{ id: 'department-in', name: 'Information Technology', code: 'IN' }],
    })
    getCodDepartmentCourseUnits.mockResolvedValue({
      success: true,
      data: { items: [
        { id: 'unit-in101', code: 'IN101', name: 'Introduction to Computing', course: { id: 'course-in16', code: '16', name: 'Computing' } },
        { id: 'unit-in102', code: 'IN102', name: 'Computer Systems', course: { id: 'course-in16', code: '16', name: 'Computing' } },
        { id: 'unit-in201', code: 'IN201', name: 'Networks', course: { id: 'course-in17', code: '17', name: 'Networking' } },
      ], pagination: { page: 1, totalPages: 1, total: 3 } },
    })

    render(<CodDepartmentWorkspace />)
    fireEvent.click(await screen.findByRole('tab', { name: 'Course units' }))

    expect(await screen.findByText('16 — Computing')).toBeTruthy()
    expect(screen.getByText('17 — Networking')).toBeTruthy()
    expect(screen.getByText('IN101')).toBeTruthy()
    expect(screen.getByText('IN102')).toBeTruthy()
    expect(screen.getByText('IN201')).toBeTruthy()
    expect(screen.queryByText('Introduction to Computing')).toBeNull()
    expect(screen.queryByText('Computer Systems')).toBeNull()
  })
})
