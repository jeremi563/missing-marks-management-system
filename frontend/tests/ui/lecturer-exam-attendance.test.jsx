import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import LecturerExamAttendance from '../../src/features/lecturer/LecturerExamAttendance'

vi.mock('../../src/api/lecturer', () => ({
  decideLecturerExamAttendanceRecords: vi.fn(),
  decideLecturerExamAttendance: vi.fn(),
  getLecturerCourseUnitAssessments: vi.fn(),
  getLecturerCourseUnits: vi.fn(),
  getLecturerExamAttendance: vi.fn(),
  getLecturerExamAttendanceRecord: vi.fn(),
}))

import {
  decideLecturerExamAttendanceRecords,
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
  status: 'LATE',
  examVerificationStatus: 'PENDING_REVIEW',
  student: { studentNumber: 'IN16/01234/26', user: { displayName: 'Student One' } },
  session: {
    startsAt: '2026-11-13T06:00:00.000Z',
    courseUnit: { code: 'IN101', name: 'Computing' },
    assessment: { code: 'EXAM', name: 'Final Exam' },
    classroom: { name: 'Room 1' },
  },
}
const secondPendingRecord = {
  ...pendingRecord,
  id: 'attendance-2',
  student: { studentNumber: 'IN16/01235/26', user: { displayName: 'Student Two' } },
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
  expect(screen.getByText('LATE')).not.toBeNull()
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

it('verifies all pending examination attendance selected on the current page in one batch', async () => {
  setup()
  getLecturerExamAttendance.mockResolvedValue({
    success: true,
    data: [pendingRecord, secondPendingRecord],
    pagination: { page: 1, totalPages: 1 },
  })
  decideLecturerExamAttendanceRecords.mockResolvedValue({ count: 2, data: [] })

  render(<LecturerExamAttendance />)
  expect(await screen.findByText('Student One')).not.toBeNull()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all pending examination attendance on this page' }))
  fireEvent.change(screen.getByLabelText('Bulk examination attendance verification comments'), { target: { value: 'Checked.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Verify 2 selected' }))

  await waitFor(() => expect(decideLecturerExamAttendanceRecords).toHaveBeenCalledWith({
    recordIds: ['attendance-1', 'attendance-2'],
    decision: 'VERIFY',
    comments: 'Checked.',
  }))
  expect(await screen.findByText('2 examination attendance records verified.')).not.toBeNull()
})

it('requires a shared rejection reason when rejecting selected exam attendance', async () => {
  setup()
  decideLecturerExamAttendanceRecords.mockResolvedValue({ count: 1, data: [] })

  render(<LecturerExamAttendance />)
  expect(await screen.findByText('Student One')).not.toBeNull()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Select all pending examination attendance on this page' }))
  fireEvent.click(screen.getByRole('button', { name: 'Reject selected' }))
  const submit = screen.getByRole('button', { name: 'Reject 1 selected' })
  expect(submit.disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Bulk examination attendance rejection reason'), { target: { value: 'Not on the register.' } })
  fireEvent.click(submit)

  await waitFor(() => expect(decideLecturerExamAttendanceRecords).toHaveBeenCalledWith({
    recordIds: ['attendance-1'],
    decision: 'REJECT',
    reason: 'Not on the register.',
  }))
  expect(await screen.findByText('1 examination attendance records rejected.')).not.toBeNull()
})
