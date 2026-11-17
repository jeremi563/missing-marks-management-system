import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import StudentAttendanceCheckIn from '../../src/features/student/StudentAttendanceCheckIn'

vi.mock('../../src/api/student', () => ({
  checkInStudentAttendance: vi.fn(),
}))

import { checkInStudentAttendance } from '../../src/api/student'

function position(latitude, longitude, accuracy) {
  return { coords: { latitude, longitude, accuracy } }
}

function createGeolocation(...positions) {
  return {
    watchPosition: vi.fn((onSuccess) => {
      queueMicrotask(() => positions.forEach(onSuccess))
      return 42
    }),
    clearWatch: vi.fn(),
  }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('StudentAttendanceCheckIn', () => {
  it('submits the QR token with the device location and shows the recorded session', async () => {
    const geolocation = createGeolocation(position(-1.286389, 36.817223, 10))
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geolocation })
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
    expect(geolocation.watchPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    })
    expect(geolocation.clearWatch).toHaveBeenCalledWith(42)
  })

  it('uses the most precise reading collected during the GPS sample window', async () => {
    const geolocation = createGeolocation(
      position(-1.2865, 36.8171, 45),
      position(-1.286389, 36.817223, 8),
    )
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geolocation })
    checkInStudentAttendance.mockResolvedValue({ success: true, data: {} })

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
        accuracyMeters: 8,
      })
    })
  })

  it('tells the student when a CAT check-in created a submission pending verification', async () => {
    const geolocation = createGeolocation(position(-1.286389, 36.817223, 10))
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: geolocation,
    })
    checkInStudentAttendance.mockResolvedValue({
      success: true,
      data: {
        session: {
          sessionType: 'CAT',
          courseUnit: { code: 'IN101', name: 'Computing' },
        },
        catSubmission: { status: 'PENDING_REVIEW' },
      },
    })
    render(
      <MemoryRouter initialEntries={['/student/attendance/check-in?token=' + 'a'.repeat(64)]}>
        <StudentAttendanceCheckIn />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Verify location and check in/ }))
    expect(await screen.findByText('Your CAT submission is awaiting lecturer verification.')).not.toBeNull()
  })

  it('tells the student when an examination check-in is pending lecturer verification', async () => {
    const geolocation = createGeolocation(position(-1.286389, 36.817223, 10))
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: geolocation,
    })
    checkInStudentAttendance.mockResolvedValue({
      success: true,
      data: {
        session: { sessionType: 'EXAM', courseUnit: { code: 'IN101', name: 'Computing' } },
        record: { examVerificationStatus: 'PENDING_REVIEW' },
      },
    })
    render(
      <MemoryRouter initialEntries={['/student/attendance/check-in?token=' + 'a'.repeat(64)]}>
        <StudentAttendanceCheckIn />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Verify location and check in/ }))
    expect(await screen.findByText('Your examination attendance is awaiting lecturer verification.')).not.toBeNull()
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
