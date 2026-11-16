import { cleanup, render, screen } from '@testing-library/react'
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
  getCodDepartments,
} from '../../src/api/cod'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('CodDepartmentWorkspace', () => {
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

    expect(await screen.findByText('16 — Computing')).toBeTruthy()
    expect(screen.getByText('17 — Networking')).toBeTruthy()
    expect(screen.getByText('IN101')).toBeTruthy()
    expect(screen.getByText('IN102')).toBeTruthy()
    expect(screen.getByText('IN201')).toBeTruthy()
    expect(screen.queryByText('Introduction to Computing')).toBeNull()
    expect(screen.queryByText('Computer Systems')).toBeNull()
  })
})
