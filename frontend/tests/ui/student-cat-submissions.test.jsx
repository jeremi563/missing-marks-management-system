import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import StudentAttendance from '../../src/features/student/StudentAttendance'

vi.mock('../../src/api/student', () => ({
  getStudentAttendance: vi.fn(),
  getStudentCatSubmissions: vi.fn(),
}))

import { getStudentAttendance, getStudentCatSubmissions } from '../../src/api/student'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('shows CAT verification status and rejection reasons in student attendance history', async () => {
  getStudentAttendance.mockResolvedValue({ data: [] })
  getStudentCatSubmissions.mockResolvedValue({
    data: [
      {
        id: 'pending-1',
        status: 'PENDING_REVIEW',
        assessment: { name: 'CAT 1', courseUnit: { code: 'IN101', name: 'Computing' } },
        academicYear: '2026/27',
        academicPeriods: [{ id: 'period-1', name: 'Term 1' }],
        createdAt: '2026-11-13T07:00:00.000Z',
      },
      {
        id: 'rejected-1',
        status: 'REJECTED',
        rejectionReason: 'The submitted work is not legible.',
        assessment: { name: 'CAT 2', courseUnit: { code: 'IN101', name: 'Computing' } },
        academicYear: '2026/27',
        academicPeriods: [],
        createdAt: '2026-11-13T07:00:00.000Z',
      },
    ],
  })

  render(<StudentAttendance />)
  expect(await screen.findByText('PENDING REVIEW')).not.toBeNull()
  expect(screen.getByText('REJECTED')).not.toBeNull()
  expect(screen.getByText('The submitted work is not legible.')).not.toBeNull()
  expect(screen.getByText('Term 1')).not.toBeNull()
})
