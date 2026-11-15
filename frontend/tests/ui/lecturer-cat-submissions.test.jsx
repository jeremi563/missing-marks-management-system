import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import LecturerCatSubmissions from '../../src/features/lecturer/LecturerCatSubmissions'

vi.mock('../../src/api/lecturer', () => ({
  decideLecturerCatSubmission: vi.fn(),
  getLecturerCatSubmission: vi.fn(),
  getLecturerCatSubmissions: vi.fn(),
  getLecturerCourseUnitAssessments: vi.fn(),
  getLecturerCourseUnits: vi.fn(),
}))

import {
  decideLecturerCatSubmission,
  getLecturerCatSubmission,
  getLecturerCatSubmissions,
  getLecturerCourseUnits,
} from '../../src/api/lecturer'

const pending = {
  id: 'submission-1',
  status: 'PENDING_REVIEW',
  createdAt: '2026-11-13T07:00:00.000Z',
  student: { studentNumber: 'IN16/01234/26', user: { displayName: 'Student One' } },
  assessment: { name: 'CAT 1', courseUnit: { id: 'unit-1', code: 'IN101', name: 'Computing' } },
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('shows pending submissions, details and verifies them', async () => {
  getLecturerCourseUnits.mockResolvedValue({ data: [{ courseUnit: { id: 'unit-1', code: 'IN101', name: 'Computing' } }] })
  getLecturerCatSubmissions.mockResolvedValue({ data: [pending], pagination: { page: 1, totalPages: 1 } })
  getLecturerCatSubmission.mockResolvedValue({
    data: {
      ...pending,
      attendanceRecord: {
        locationVerified: true,
        recordedAt: '2026-11-13T07:00:00.000Z',
        session: { startsAt: '2026-11-13T06:00:00.000Z' },
      },
      academicYear: '2026/27',
    },
  })
  decideLecturerCatSubmission.mockResolvedValue({ data: { ...pending, status: 'VERIFIED', verifiedAt: '2026-11-13T08:00:00.000Z' } })

  render(<LecturerCatSubmissions />)
  expect(await screen.findByText('Student One')).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'View' }))
  expect(await screen.findByText('2026/27')).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Verify submission' }))
  await waitFor(() => expect(decideLecturerCatSubmission).toHaveBeenCalledWith('submission-1', { decision: 'VERIFY' }))
  expect(await screen.findByText('CAT submission verified.')).not.toBeNull()
})

it('requires a rejection reason before rejection can be submitted', async () => {
  getLecturerCourseUnits.mockResolvedValue({ data: [] })
  getLecturerCatSubmissions.mockResolvedValue({ data: [pending], pagination: { page: 1, totalPages: 1 } })
  getLecturerCatSubmission.mockResolvedValue({
    data: { ...pending, attendanceRecord: { session: {} } },
  })

  render(<LecturerCatSubmissions />)
  fireEvent.click(await screen.findByRole('button', { name: 'View' }))
  const reject = await screen.findByRole('button', { name: 'Reject submission' })
  expect(reject.disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Rejection reason (required to reject)'), { target: { value: 'Not legible' } })
  expect(reject.disabled).toBe(false)
})
