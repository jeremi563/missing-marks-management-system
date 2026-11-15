import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import LecturerExamAttendance from '../../src/features/lecturer/LecturerExamAttendance'

vi.mock('../../src/api/lecturer', () => ({
  decideLecturerExamAttendance: vi.fn(),
  getLecturerCourseUnitAssessments: vi.fn(),
  getLecturerCourseUnits: vi.fn(),
  getLecturerExamAttendance: vi.fn(),
  getLecturerExamAttendanceRecord: vi.fn(),
}))

import {
  decideLecturerExamAttendance,
  getLecturerCourseUnitAssessments,
  getLecturerCourseUnits,
  getLecturerExamAttendance,
  getLecturerExamAttendanceRecord,
} from '../../src/api/lecturer'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const pendingRecord = {
  id: 'attendance-1',
  recordedAt: '2026-11-13T07:00:00.000Z',
  examVerificationStatus: 'PENDING_REVIEW',
  student: { studentNumber: 'IN16/01234/26', user: { displayName: 'Student One' } },
  session: {
    startsAt: '2026-11-13T06:00:00.000Z',
    courseUnit: { code: 'IN101', name: 'Computing' },
    assessment: { code: 'EXAM', name: 'Final Exam' },
    classroom: { name: 'Room 1' },
  },
}

function setup() {
  getLecturerCourseUnits.mockResolvedValue({ data: [{ courseUnit: { id: 'unit-1', code: 'IN101', name: 'Computing' } }] })
  getLecturerCourseUnitAssessments.mockResolvedValue({ data: [{ id: 'exam-1', code: 'EXAM', name: 'Final Exam' }] })
  getLecturerExamAttendance.mockResolvedValue({
    success: true,
    data: [pendingRecord],
    pagination: { page: 1, totalPages: 1 },
  })
  getLecturerExamAttendanceRecord.mockResolvedValue({ success: true, data: pendingRecord })
}

it('shows pending examination attendance and requires a reason before rejection', async () => {
  setup()
  render(<LecturerExamAttendance />)

  expect(await screen.findByText('Student One')).not.toBeNull()
  expect(screen.getByText('PENDING REVIEW')).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'View' }))
  expect(await screen.findByText('Final Exam')).not.toBeNull()
  const reject = screen.getByRole('button', { name: 'Reject attendance' })
  expect(reject.disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Rejection reason (required to reject)'), { target: { value: 'Not on register.' } })
  expect(reject.disabled).toBe(false)
  fireEvent.click(reject)
  await waitFor(() => expect(decideLecturerExamAttendance).toHaveBeenCalledWith('attendance-1', {
    decision: 'REJECT',
    reason: 'Not on register.',
  }))
})

it('supports verification with optional comments and then displays the decision', async () => {
  setup()
  const verified = {
    ...pendingRecord,
    examVerificationStatus: 'VERIFIED',
    examVerifiedAt: '2026-11-13T08:00:00.000Z',
    examComments: 'Matched the register.',
  }
  decideLecturerExamAttendance.mockResolvedValue({ success: true, data: verified })
  render(<LecturerExamAttendance />)
  fireEvent.click(await screen.findByRole('button', { name: 'View' }))
  fireEvent.change(await screen.findByLabelText('Verification comments (optional)'), { target: { value: 'Matched the register.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Verify attendance' }))

  await waitFor(() => expect(decideLecturerExamAttendance).toHaveBeenCalledWith('attendance-1', {
    decision: 'VERIFY',
    comments: 'Matched the register.',
  }))
  expect(await screen.findByText('Examination attendance verified.')).not.toBeNull()
  expect(screen.getByText('Matched the register.')).not.toBeNull()
})
