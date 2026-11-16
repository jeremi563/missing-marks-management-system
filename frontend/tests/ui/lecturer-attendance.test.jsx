import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LecturerAttendance from '../../src/features/lecturer/LecturerAttendance'

vi.mock('../../src/api/lecturer', () => ({
  createLecturerAttendanceSession: vi.fn(),
  endLecturerAttendanceSession: vi.fn(),
  extendLecturerAttendanceSession: vi.fn(),
  generateLecturerAttendanceLink: vi.fn(),
  getLecturerClassrooms: vi.fn(),
  getLecturerCourseUnitAssessments: vi.fn(),
  getLecturerCourseUnits: vi.fn(),
  getLecturerAttendanceSessions: vi.fn(),
  startLecturerAttendanceSession: vi.fn(),
}))

import {
  createLecturerAttendanceSession,
  getLecturerClassrooms,
  getLecturerCourseUnitAssessments,
  getLecturerCourseUnits,
  getLecturerAttendanceSessions,
  startLecturerAttendanceSession,
  generateLecturerAttendanceLink,
  extendLecturerAttendanceSession,
} from '../../src/api/lecturer'

vi.mock('qrcode', () => ({
  default: { toString: vi.fn().mockResolvedValue('<svg xmlns="http://www.w3.org/2000/svg"></svg>') },
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('LecturerAttendance', () => {
  it('uses one date for both attendance session start and end', async () => {
    getLecturerAttendanceSessions.mockResolvedValue({ success: true, data: { sessions: [] } })
    getLecturerCourseUnits.mockResolvedValue({
      success: true,
      data: [{
        courseUnit: { id: 'course-1', code: 'IN101', name: 'Computing' },
      }],
    })
    getLecturerCourseUnitAssessments.mockResolvedValue({
      success: true,
      data: [{ id: 'assessment-1', code: 'CAT1', name: 'CAT 1' }],
    })
    getLecturerClassrooms.mockResolvedValue({
      success: true,
      data: [{ id: 'classroom-1', name: 'Block A, Room 12', boundaryMeters: 80 }],
    })
    createLecturerAttendanceSession.mockResolvedValue({ success: true })

    render(<LecturerAttendance />)

    fireEvent.change(await screen.findByLabelText('Course unit'), { target: { value: 'course-1' } })
    await screen.findByRole('option', { name: /CAT 1/ })
    fireEvent.change(screen.getByLabelText('Classroom'), { target: { value: 'classroom-1' } })
    fireEvent.change(screen.getByLabelText('CAT number'), { target: { value: 'assessment-1' } })
    fireEvent.change(screen.getByLabelText('Session date'), { target: { value: '2026-11-13' } })
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '09:00' } })
    fireEvent.change(screen.getByLabelText(/End time/), { target: { value: '10:00' } })

    expect(screen.queryByLabelText(/End date/)).toBeNull()
    const form = screen.getByRole('button', { name: 'Create cat session' }).closest('form')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create cat session' }).disabled).toBe(false))
    fireEvent.submit(form)

    await waitFor(() => {
      expect(createLecturerAttendanceSession).toHaveBeenCalledWith(expect.objectContaining({
        classroomId: 'classroom-1',
        startsAt: new Date('2026-11-13T09:00').toISOString(),
        endsAt: new Date('2026-11-13T10:00').toISOString(),
      }))
    })
  })

  it('rejects an end time that is not after the start time', async () => {
    getLecturerAttendanceSessions.mockResolvedValue({ success: true, data: { sessions: [] } })
    getLecturerCourseUnits.mockResolvedValue({
      success: true,
      data: [{ courseUnit: { id: 'course-1', code: 'IN101', name: 'Computing' } }],
    })
    getLecturerCourseUnitAssessments.mockResolvedValue({
      success: true,
      data: [{ id: 'assessment-1', code: 'CAT1', name: 'CAT 1' }],
    })
    getLecturerClassrooms.mockResolvedValue({
      success: true,
      data: [{ id: 'classroom-1', name: 'Block A, Room 12', boundaryMeters: 80 }],
    })

    render(<LecturerAttendance />)

    fireEvent.change(await screen.findByLabelText('Course unit'), { target: { value: 'course-1' } })
    await screen.findByRole('option', { name: /CAT 1/ })
    fireEvent.change(screen.getByLabelText('Classroom'), { target: { value: 'classroom-1' } })
    fireEvent.change(screen.getByLabelText('CAT number'), { target: { value: 'assessment-1' } })
    fireEvent.change(screen.getByLabelText('Session date'), { target: { value: '2026-11-13' } })
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText(/End time/), { target: { value: '09:00' } })
    const form = screen.getByRole('button', { name: 'Create cat session' }).closest('form')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create cat session' }).disabled).toBe(false))
    fireEvent.submit(form)

    expect(await screen.findAllByText('End time must be after the start time.')).not.toHaveLength(0)
    expect(createLecturerAttendanceSession).not.toHaveBeenCalled()
  })

  it('starts an attendance session and displays a QR code with a shareable student link', async () => {
    const scheduledSession = {
      id: 'session-1',
      sessionType: 'CLASS',
      status: 'scheduled',
      startsAt: '2026-11-13T06:00:00.000Z',
      courseUnit: { code: 'IN101', name: 'Computing' },
      classroom: { name: 'Room 1' },
    }
    const activeSession = { ...scheduledSession, status: 'active' }
    getLecturerAttendanceSessions
      .mockResolvedValueOnce({ success: true, data: { sessions: [scheduledSession] } })
      .mockResolvedValueOnce({ success: true, data: { sessions: [activeSession] } })
    getLecturerCourseUnits.mockResolvedValue({ success: true, data: [] })
    getLecturerClassrooms.mockResolvedValue({ success: true, data: [] })
    startLecturerAttendanceSession.mockResolvedValue({ success: true })
    generateLecturerAttendanceLink.mockResolvedValue({ success: true, data: { qrToken: 'a'.repeat(64) } })

    render(<LecturerAttendance />)
    fireEvent.click(await screen.findByRole('tab', { name: /Class/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }))

    const attendanceLink = await screen.findByLabelText('Attendance link')
    expect(attendanceLink.value).toBe(`${window.location.origin}/student/attendance/check-in?token=${'a'.repeat(64)}`)
    expect(await screen.findByAltText('QR code for student attendance check-in')).not.toBeNull()
    expect(screen.queryByText('Share attendance check-in')).toBeNull()
    expect(screen.queryByText(/Students scan this QR code/)).toBeNull()
    expect(screen.getByRole('button', { name: /Copy link/ })).not.toBeNull()
    expect(screen.getByRole('button', { name: /Share link/ })).not.toBeNull()
    expect(generateLecturerAttendanceLink).toHaveBeenCalledWith('session-1')
  })

  it('generates a fresh attendance link for an active session after reloading the page', async () => {
    getLecturerAttendanceSessions.mockResolvedValue({
      success: true,
      data: { sessions: [{
        id: 'session-2',
        sessionType: 'CLASS',
        status: 'active',
        startsAt: '2026-11-13T06:00:00.000Z',
        courseUnit: { code: 'IN101', name: 'Computing' },
        classroom: { name: 'Room 1' },
      }] },
    })
    getLecturerCourseUnits.mockResolvedValue({ success: true, data: [] })
    getLecturerClassrooms.mockResolvedValue({ success: true, data: [] })
    generateLecturerAttendanceLink.mockResolvedValue({ success: true, data: { qrToken: 'b'.repeat(64) } })

    render(<LecturerAttendance />)
    fireEvent.click(await screen.findByRole('tab', { name: /Class/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Generate attendance link' }))

    const attendanceLink = await screen.findByLabelText('Attendance link')
    expect(attendanceLink.value).toBe(`${window.location.origin}/student/attendance/check-in?token=${'b'.repeat(64)}`)
    expect(generateLecturerAttendanceLink).toHaveBeenCalledWith('session-2')
  })

  it('lets the lecturer extend an active session end time', async () => {
    const activeSession = {
      id: 'session-3',
      sessionType: 'CLASS',
      status: 'active',
      startsAt: '2030-01-01T06:00:00.000Z',
      endsAt: '2030-01-01T08:00:00.000Z',
      courseUnit: { code: 'IN101', name: 'Computing' },
      classroom: { name: 'Room 1' },
    }
    getLecturerAttendanceSessions
      .mockResolvedValueOnce({ success: true, data: { sessions: [activeSession] } })
      .mockResolvedValueOnce({ success: true, data: { sessions: [{ ...activeSession, endsAt: '2030-01-01T09:00:00.000Z' }] } })
    getLecturerCourseUnits.mockResolvedValue({ success: true, data: [] })
    getLecturerClassrooms.mockResolvedValue({ success: true, data: [] })
    extendLecturerAttendanceSession.mockResolvedValue({ success: true })

    render(<LecturerAttendance />)
    fireEvent.click(await screen.findByRole('tab', { name: /Class/ }))
    const adjustEndTime = screen.getByRole('button', { name: 'Adjust end time' })
    expect(adjustEndTime.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(adjustEndTime)
    const endTimeInput = await screen.findByLabelText('New end time')
    fireEvent.change(endTimeInput, { target: { value: '2030-01-01T12:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save new end time' }))

    await waitFor(() => {
      expect(extendLecturerAttendanceSession).toHaveBeenCalledWith('session-3', new Date('2030-01-01T12:00').toISOString())
    })
  })
})
