import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import StudentAttendanceCheckIn from '../../src/features/student/StudentAttendanceCheckIn'

vi.mock('../../src/api/student', () => ({
  checkInStudentAttendance: vi.fn(),
}))

import { checkInStudentAttendance } from '../../src/api/student'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('StudentAttendanceCheckIn', () => {
  it('submits the QR token with the device location and shows the recorded session', async () => {
    const getCurrentPosition = vi.fn((success) => success({
      coords: { latitude: -1.286389, longitude: 36.817223, accuracy: 10 },
    }))
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } })
    checkInStudentAttendance.mockResolvedValue({
      success: true,
      data: {
        session: {
          courseUnit: { code: 'IN101', name: 'Computing' },
          classroomName: 'Room 1',
        },
      },
    })

    render(
      <MemoryRouter initialEntries={['/student/attendance/check-in?token=' + 'a'.repeat(64)]}>
        <StudentAttendanceCheckIn />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Verify location and check in/ }))

    await waitFor(() => {
      expect(checkInStudentAttendance).toHaveBeenCalledWith({
        token: 'a'.repeat(64),
        latitude: -1.286389,
        longitude: 36.817223,
        accuracyMeters: 10,
      })
    })
    expect(await screen.findByText('Attendance recorded')).not.toBeNull()
    expect(screen.getByText('IN101 — Computing')).not.toBeNull()
    expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    })
  })

  it('explains that students need a valid scanned attendance link', () => {
    render(
      <MemoryRouter initialEntries={['/student/attendance/check-in']}>
        <StudentAttendanceCheckIn />
      </MemoryRouter>,
    )
    expect(screen.getByText('Scan a current attendance QR code or open the link sent by your lecturer.')).not.toBeNull()
    expect(screen.getByRole('button', { name: /Verify location and check in/ }).disabled).toBe(true)
  })
})
