import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CodCourseUnitAssignments from '../../src/features/cod/CodCourseUnitAssignments'
import { academicYearForDate } from '../../src/shared/academic-year'

vi.mock('../../src/api/cod', () => ({
  assignCodLecturerToCourseUnit: vi.fn(),
  getCodDepartmentCourseUnits: vi.fn(),
  getCodDepartmentLecturers: vi.fn(),
  getCodDepartments: vi.fn(),
}))

import {
  assignCodLecturerToCourseUnit,
  getCodDepartmentCourseUnits,
  getCodDepartmentLecturers,
  getCodDepartments,
} from '../../src/api/cod'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('CodCourseUnitAssignments', () => {
  it('indicates the current academic year while delegating course units', async () => {
    const now = new Date()
    const academicYear = academicYearForDate(now)
    const course = { id: 'course-in16', code: '16', name: 'Computing' }
    getCodDepartments.mockResolvedValue({
      success: true,
      data: [{ id: 'department-in', name: 'Information Technology', code: 'IN' }],
    })
    getCodDepartmentCourseUnits.mockResolvedValue({
      success: true,
      data: { items: [
        { id: 'unit-in101', code: 'IN101', name: 'Introduction to Computing', course, lecturerMappings: [] },
        { id: 'unit-in102', code: 'IN102', name: 'Computer Systems', course, lecturerMappings: [] },
        { id: 'unit-in201', code: 'IN201', name: 'Networks', course: { id: 'course-in17', code: '17', name: 'Networking' }, lecturerMappings: [] },
      ] },
    })
    getCodDepartmentLecturers.mockResolvedValue({
      success: true,
      data: { items: [] },
    })

    render(<CodCourseUnitAssignments />)

    const yearLabel = await screen.findByText(academicYear)
    expect(yearLabel.closest('.cod-unit-delegation__year').textContent).toContain('Academic year')
    expect(await screen.findByText('16 — Computing')).toBeTruthy()
    expect(screen.getByText('17 — Networking')).toBeTruthy()
    expect(screen.getAllByText('IN101')).toHaveLength(1)
    expect(screen.getByText('IN102')).toBeTruthy()
    expect(screen.getByText('Introduction to Computing')).toBeTruthy()
    expect(screen.getByText('Computer Systems')).toBeTruthy()
    expect(screen.getByText('Needs assignment')).toBeTruthy()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search course units' }), { target: { value: 'Networks' } })
    expect(screen.getByText('IN201')).toBeTruthy()
    expect(screen.queryByText('IN101')).toBeNull()
  })

  it('shows the current lecturer and offers replacement for an existing assignment', async () => {
    const course = { id: 'course-in16', code: '16', name: 'Computing' }
    getCodDepartments.mockResolvedValue({
      success: true,
      data: [{ id: 'department-in', name: 'Information Technology', code: 'IN' }],
    })
    getCodDepartmentCourseUnits.mockResolvedValue({
      success: true,
      data: { items: [{
        id: 'unit-in101',
        code: 'IN101',
        course,
        lecturerMappings: [{
          id: 'mapping-1',
          lecturer: {
            id: 'lecturer-profile-1',
            user: { displayName: 'Current Lecturer', email: 'current@example.test' },
          },
        }],
      }] },
    })
    getCodDepartmentLecturers.mockResolvedValue({
      success: true,
      data: { items: [
        { displayName: 'Current Lecturer', lecturerProfile: { id: 'lecturer-profile-1' } },
        { displayName: 'Replacement Lecturer', lecturerProfile: { id: 'lecturer-profile-2', staffNumber: 'AB/1234/STAFF1' } },
      ] },
    })

    render(<CodCourseUnitAssignments />)

    expect(await screen.findByText('Current Lecturer')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Replace' })).toBeTruthy()
    expect(screen.getByRole('option', { name: /Replacement Lecturer/ })).toBeTruthy()
    expect(assignCodLecturerToCourseUnit).not.toHaveBeenCalled()
  })
})
