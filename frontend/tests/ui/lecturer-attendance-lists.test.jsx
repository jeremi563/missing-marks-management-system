import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LecturerAttendanceLists from '../../src/features/lecturer/LecturerAttendanceLists'

vi.mock('../../src/api/lecturer', () => ({
  getLecturerAttendanceRecords: vi.fn(),
  getLecturerAttendanceSessions: vi.fn(),
}))

import {
  getLecturerAttendanceRecords,
  getLecturerAttendanceSessions,
} from '../../src/api/lecturer'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('LecturerAttendanceLists', () => {
  it('shows per-session enrolled rosters with attended and absent students for all session types', async () => {
    getLecturerAttendanceSessions.mockImplementation(async ({ sessionType }) => ({
      success: true,
      data: [{
        id: `${sessionType.toLowerCase()}-session`,
        sessionType,
        startsAt: '2026-11-13T07:00:00.000Z',
        courseUnit: { code: 'IN101', name: 'Computing' },
        classroom: { name: 'Room 1' },
        assessment: sessionType === 'CLASS' ? null : { name: `${sessionType} assessment` },
      }],
      pagination: { page: 1, totalPages: 1, total: 1 },
    }))
    getLecturerAttendanceRecords.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'record-1',
          student: { id: 'student-1', studentNumber: 'IN16/00001/26', user: { displayName: 'Ada Student' } },
          academicPeriods: [{ academicYear: '2026/27', semester: 1 }],
          status: 'PRESENT',
          attended: true,
          locationVerified: true,
          recordedAt: '2026-11-13T07:10:00.000Z',
        },
        {
          id: 'record-late',
          student: { id: 'student-late', studentNumber: 'IN16/00003/26', user: { displayName: 'Casey Student' } },
          academicPeriods: [{ academicYear: '2026/27', semester: 1 }],
          status: 'LATE',
          attended: true,
          locationVerified: true,
          recordedAt: '2026-11-13T07:20:00.000Z',
        },
        {
          id: null,
          student: { id: 'student-2', studentNumber: 'IN16/00002/26', user: { displayName: 'Ben Student' } },
          academicPeriods: [{ academicYear: '2026/27', semester: 1 }],
          status: 'ABSENT',
          attended: false,
          locationVerified: null,
          recordedAt: null,
        },
      ],
    })

    render(<LecturerAttendanceLists />)

    expect(await screen.findByRole('region', { name: 'IN101 roster' })).toBeTruthy()
    expect(await screen.findByText('Ada Student')).toBeTruthy()
    expect(await screen.findByText('Casey Student')).toBeTruthy()
    expect(screen.getByText('Ben Student')).toBeTruthy()
    expect(screen.getByText('Attended')).toBeTruthy()
    expect(screen.getByText('Late')).toBeTruthy()
    expect(screen.getByText('Did not attend')).toBeTruthy()
    expect(screen.getAllByText('2026/27 · Semester 1')).toHaveLength(3)
    expect(getLecturerAttendanceRecords).toHaveBeenLastCalledWith('class-session')

    fireEvent.click(screen.getByRole('tab', { name: 'CAT attendance' }))
    await waitFor(() => {
      expect(getLecturerAttendanceSessions).toHaveBeenLastCalledWith({
        page: 1,
        limit: 20,
        sessionType: 'CAT',
      })
    })
    await waitFor(() => expect(getLecturerAttendanceRecords).toHaveBeenLastCalledWith('cat-session'))
    expect(screen.getAllByText('CAT assessment')).toHaveLength(2)

    fireEvent.click(screen.getByRole('tab', { name: 'Exam attendance' }))
    await waitFor(() => {
      expect(getLecturerAttendanceSessions).toHaveBeenLastCalledWith({
        page: 1,
        limit: 20,
        sessionType: 'EXAM',
      })
    })
    await waitFor(() => expect(getLecturerAttendanceRecords).toHaveBeenLastCalledWith('exam-session'))
    expect(screen.getAllByText('EXAM assessment')).toHaveLength(2)
  })
})
