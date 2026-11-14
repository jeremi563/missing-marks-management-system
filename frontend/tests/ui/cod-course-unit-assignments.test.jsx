import { cleanup, render, screen } from '@testing-library/react'
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
    expect(yearLabel.parentElement.textContent).toContain('Current academic year:')
    expect(await screen.findByText('16 — Computing')).toBeTruthy()
    expect(screen.getByText('17 — Networking')).toBeTruthy()
    expect(screen.getAllByText('IN101')).toHaveLength(1)
    expect(screen.getByText('IN102')).toBeTruthy()
    expect(screen.queryByText('Introduction to Computing')).toBeNull()
    expect(screen.queryByText('Computer Systems')).toBeNull()
  })
})
