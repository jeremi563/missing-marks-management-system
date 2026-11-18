import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LecturerStudents from '../../src/features/lecturer/LecturerStudents'

vi.mock('../../src/api/lecturer', () => ({
  getLecturerDepartments: vi.fn(),
  getLecturerStudents: vi.fn(),
}))

import {
  getLecturerDepartments,
  getLecturerStudents,
} from '../../src/api/lecturer'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('LecturerStudents', () => {
  it('groups enrolled students by course and limits department filters to assigned departments', async () => {
    getLecturerDepartments.mockResolvedValue({
      success: true,
      data: {
        assignedDepartments: [{ id: 'department-in', name: 'Information Technology', code: 'IN' }],
      },
    })
    getLecturerStudents.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'enrollment-1',
          student: { studentNumber: 'IN/100/2026', user: { displayName: 'Sam Student', email: 'sam@example.test' } },
          courseUnit: { id: 'unit-in101', code: 'IN101', name: 'Computing', department: { id: 'department-in', name: 'Information Technology' } },
          academicPeriod: { id: 'period-1', name: 'Semester One', academicYear: '2026/27', semester: 1 },
        },
        {
          id: 'enrollment-2',
          student: { studentNumber: 'IN/101/2026', user: { displayName: 'Alex Student', email: 'alex@example.test' } },
          courseUnit: { id: 'unit-in102', code: 'IN102', name: 'Networks', department: { id: 'department-in', name: 'Information Technology' } },
          academicPeriod: { name: 'Semester One', academicYear: '2026/27', semester: 1 },
        },
      ],
      pagination: { page: 1, totalPages: 1, total: 2 },
      filters: { academicPeriods: [{ id: 'period-1', name: 'Semester One', academicYear: '2026/27', semester: 1 }] },
    })
    render(<LecturerStudents />)

    expect(await screen.findByRole('region', { name: 'IN101 enrolled students' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'IN102 enrolled students' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Filter by department' })).toBeNull()
    expect(screen.queryByText('Filter by department')).toBeNull()
    expect(screen.queryByText('Department memberships')).toBeNull()
    expect(screen.getAllByRole('columnheader', { name: 'Academic year' })).toHaveLength(2)
    expect(screen.getAllByRole('columnheader', { name: 'Semester' })).toHaveLength(2)
    expect(screen.getAllByRole('cell', { name: '2026/27' })).toHaveLength(2)
    expect(screen.getAllByRole('cell', { name: 'Semester 1' })).toHaveLength(2)
    expect(screen.getByRole('option', { name: '2026/27 · Semester 1' })).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Filter by academic year and semester'), { target: { value: 'period-1' } })
    await waitFor(() => {
      expect(getLecturerStudents).toHaveBeenLastCalledWith({
        page: 1,
        limit: 20,
        academicPeriodId: 'period-1',
      })
    })
    fireEvent.change(screen.getByLabelText('Search students or course units'), { target: { value: 'Sam' } })
    await waitFor(() => {
      expect(getLecturerStudents).toHaveBeenLastCalledWith({
        page: 1,
        limit: 20,
        academicPeriodId: 'period-1',
        search: 'Sam',
      })
    })
  })

  it('lets lecturers quickly select or clear assigned department filters', async () => {
    getLecturerDepartments.mockResolvedValue({
      success: true,
      data: {
        assignedDepartments: [
          { id: 'department-in', name: 'Information Technology', code: 'IN' },
          { id: 'department-cs', name: 'Computer Science', code: 'CS' },
        ],
      },
    })
    getLecturerStudents.mockResolvedValue({
      success: true,
      data: [],
      pagination: { page: 1, totalPages: 1, total: 0 },
    })

    render(<LecturerStudents />)

    expect(await screen.findByRole('region', { name: 'Filter by department' })).toBeTruthy()
    expect(await screen.findByText('All 2 departments')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: /IN Information Technology/ }))
    expect(await screen.findByText('1 of 2 departments')).toBeTruthy()
    await waitFor(() => {
      expect(getLecturerStudents).toHaveBeenLastCalledWith({
        page: 1,
        limit: 20,
        departmentIds: 'department-cs',
      })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(await screen.findByText('Select a department')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }))
    expect(await screen.findByText('All 2 departments')).toBeTruthy()
  })
})
