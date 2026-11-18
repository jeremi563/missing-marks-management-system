import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

vi.mock('../../src/components/ui/QrCameraScanner', () => ({
  default: ({ onDecode }) => <button type="button" onClick={() => onDecode('a'.repeat(64))}>Fake camera scan</button>,
}))

vi.mock('../../src/api/student', () => ({
  getStudentExamAttendance: vi.fn(),
  getStudentExamBooklets: vi.fn(),
  scanStudentExamBooklet: vi.fn(),
}))

vi.mock('../../src/api/lecturer', () => ({
  allocateLecturerExamBooklets: vi.fn(),
  getLecturerAttendanceSessions: vi.fn(),
  getLecturerExamBookletScans: vi.fn(),
  manualLookupLecturerExamBooklet: vi.fn(),
  previewLecturerExamBooklet: vi.fn(),
  replaceLecturerExamBooklet: vi.fn(),
  scanLecturerExamBooklet: vi.fn(),
}))

import StudentExamBookletVerification from '../../src/features/student/StudentExamBookletVerification'
import LecturerExamBooklets from '../../src/features/lecturer/LecturerExamBooklets'
import { getStudentExamAttendance, getStudentExamBooklets, scanStudentExamBooklet } from '../../src/api/student'
import {
  allocateLecturerExamBooklets,
  getLecturerAttendanceSessions,
  getLecturerExamBookletScans,
  previewLecturerExamBooklet,
  scanLecturerExamBooklet,
} from '../../src/api/lecturer'

function activeExamWindow() {
  const now = Date.now()
  return {
    status: 'active',
    startsAt: new Date(now - 60_000).toISOString(),
    endsAt: new Date(now + 60 * 60_000).toISOString(),
    lateGraceMinutes: 10,
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('refreshes the student booklet and exam attendance status after a successful scan', async () => {
  getStudentExamBooklets.mockResolvedValue({
    data: [{
      id: 'booklet-1',
      bookletIdentifier: 'booklet-ref',
      status: 'ALLOCATED',
      assessment: { code: 'EXAM', name: 'Final Exam' },
      session: { id: 'session-1', ...activeExamWindow(), courseUnit: { code: 'IN101', name: 'Computing' } },
    }],
  })
  getStudentExamAttendance
    .mockResolvedValueOnce({ data: [{ session: { id: 'session-1' }, examVerificationStatus: 'PENDING_REVIEW' }] })
    .mockResolvedValueOnce({ data: [{ session: { id: 'session-1' }, examVerificationStatus: 'VERIFIED' }] })
  scanStudentExamBooklet.mockResolvedValue({ data: { status: 'VERIFIED', examVerificationStatus: 'VERIFIED' } })

  render(<StudentExamBookletVerification />)
  expect(await screen.findByText('PENDING REVIEW')).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Fake camera scan' }))

  await waitFor(() => expect(scanStudentExamBooklet).toHaveBeenCalledWith({ sessionId: 'session-1', token: 'a'.repeat(64) }))
  expect(await screen.findByText('VERIFIED')).not.toBeNull()
  expect(screen.getByText('Booklet verified. Your examination attendance is now verified.')).not.toBeNull()
  expect(getStudentExamAttendance).toHaveBeenCalledTimes(2)
})

it('requires physical identity confirmation after an invigilator previews a scanned allocation', async () => {
  getLecturerAttendanceSessions.mockResolvedValue({
    data: [{ id: 'session-1', ...activeExamWindow(), sessionType: 'EXAM', courseUnit: { code: 'IN101' }, assessment: { name: 'Final Exam' } }],
  })
  getLecturerExamBookletScans.mockResolvedValue({ data: { items: [] } })
  previewLecturerExamBooklet.mockResolvedValue({
    data: {
      student: { studentNumber: 'IN16/01234/26', user: { displayName: 'Student One' } },
      bookletIdentifier: 'booklet-ref',
      assessment: { name: 'Final Exam' },
    },
  })
  scanLecturerExamBooklet.mockResolvedValue({ data: { status: 'VERIFIED' } })
  allocateLecturerExamBooklets.mockResolvedValue({ data: { allocations: [], newlyAllocatedCount: 0 } })

  render(<LecturerExamBooklets />)
  fireEvent.click(await screen.findByRole('button', { name: 'Fake camera scan' }))
  expect(await screen.findByText('Student One')).not.toBeNull()
  expect(screen.getByText('IN16/01234/26')).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Identity confirmed — verify booklet' }))

  await waitFor(() => expect(scanLecturerExamBooklet).toHaveBeenCalledWith('session-1', {
    token: 'a'.repeat(64),
    identityConfirmed: true,
  }))
  expect(await screen.findByText('Booklet verified and examination attendance updated.')).not.toBeNull()
})

it('disables student booklet scanning after the session grace cutoff', async () => {
  const now = Date.now()
  getStudentExamBooklets.mockResolvedValue({
    data: [{
      id: 'booklet-1',
      bookletIdentifier: 'booklet-ref',
      status: 'ALLOCATED',
      assessment: { code: 'EXAM', name: 'Final Exam' },
      session: {
        id: 'session-1',
        status: 'active',
        startsAt: new Date(now - 60 * 60_000).toISOString(),
        endsAt: new Date(now - 11 * 60_000).toISOString(),
        lateGraceMinutes: 10,
        courseUnit: { code: 'IN101', name: 'Computing' },
      },
    }],
  })
  getStudentExamAttendance.mockResolvedValue({ data: [] })

  render(<StudentExamBookletVerification />)

  expect(await screen.findByText('Booklet verification is closed for this examination session.')).not.toBeNull()
  expect(screen.queryByRole('button', { name: 'Fake camera scan' })).toBeNull()
})

it('disables invigilator QR and manual verification after the session grace cutoff', async () => {
  const now = Date.now()
  getLecturerAttendanceSessions.mockResolvedValue({
    data: [{
      id: 'session-1',
      sessionType: 'EXAM',
      status: 'active',
      startsAt: new Date(now - 60 * 60_000).toISOString(),
      endsAt: new Date(now - 11 * 60_000).toISOString(),
      lateGraceMinutes: 10,
      courseUnit: { code: 'IN101' },
      assessment: { name: 'Final Exam' },
    }],
  })
  getLecturerExamBookletScans.mockResolvedValue({ data: { items: [] } })

  render(<LecturerExamBooklets />)

  expect(await screen.findByText('Booklet verification is closed for this examination session.')).not.toBeNull()
  expect(screen.queryByRole('button', { name: 'Fake camera scan' })).toBeNull()
  expect(screen.getByLabelText('Student registration number').disabled).toBe(true)
  expect(screen.getByRole('button', { name: 'Find and verify allocation' }).disabled).toBe(true)
})
