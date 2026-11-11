import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StudentReports from '../../src/features/student/StudentReports'

vi.mock('../../src/api/student', () => ({
  getStudentReports: vi.fn(),
}))

import { getStudentReports } from '../../src/api/student'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('StudentReports', () => {
  it('renders mocked reports and filters by status', async () => {
    getStudentReports.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'report-1',
          reference: 'MM-001',
          status: 'Submitted',
          courseUnit: { code: 'CSC101', name: 'Programming' },
          submittedAt: '2026-10-01T10:00:00.000Z',
        },
        {
          id: 'report-2',
          reference: 'MM-002',
          status: 'Rejected',
          courseUnit: { code: 'MAT101', name: 'Calculus' },
          submittedAt: '2026-10-02T10:00:00.000Z',
        },
      ],
      pagination: { totalPages: 1, total: 2 },
    })

    render(
      <MemoryRouter>
        <StudentReports />
      </MemoryRouter>
    )

    expect(await screen.findByText('MM-001')).toBeTruthy()
    expect(screen.getByText('MM-002')).toBeTruthy()
    expect(
      screen.getAllByRole('link', { name: 'View details' })
        .map((link) => link.getAttribute('href'))
    ).toEqual([
      '/student/reports/report-1',
      '/student/reports/report-2',
    ])

    fireEvent.change(screen.getByLabelText('Filter by status'), {
      target: { value: 'REJECTED' },
    })

    expect(screen.getByText('MM-002')).toBeTruthy()
    expect(screen.queryByText('MM-001')).toBeNull()
  })

  it('shows an empty state when no reports are returned', async () => {
    getStudentReports.mockResolvedValue({
      success: true,
      data: [],
      pagination: { totalPages: 0, total: 0 },
    })

    render(
      <MemoryRouter>
        <StudentReports />
      </MemoryRouter>
    )

    expect(await screen.findByText('No reports found')).toBeTruthy()
  })
})