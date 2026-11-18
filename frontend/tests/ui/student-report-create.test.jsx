import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StudentReportCreate from '../../src/features/student/StudentReportCreate'

vi.mock('../../src/api/student', () => ({
  createStudentReport: vi.fn(),
  getStudentReportOptions: vi.fn(),
}))

import { createStudentReport, getStudentReportOptions } from '../../src/api/student'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('StudentReportCreate', () => {
  it('offers enrolled department courses and academic years without assessment inputs', async () => {
    getStudentReportOptions.mockResolvedValue({
      success: true,
      data: [{
        id: 'course-1',
        code: 'IN101',
        name: 'Introduction to Computing',
        academicYears: [
          { value: '2026/27', label: '2026/27', academicPeriodId: 'period-1' },
        ],
      }],
    })
    createStudentReport.mockResolvedValue({ success: true })

    render(
      <MemoryRouter>
        <StudentReportCreate />
      </MemoryRouter>
    )

    const courseSelect = await screen.findByLabelText('Course unit')
    expect(screen.queryByLabelText('Assessment component')).toBeNull()
    expect(screen.queryByLabelText('Assessment ID')).toBeNull()
    expect(await screen.findByRole('option', { name: 'IN101 — Introduction to Computing' })).toBeTruthy()

    fireEvent.change(courseSelect, { target: { value: 'course-1' } })
    const academicYearSelect = screen.getByLabelText('Academic year')
    expect(screen.getAllByRole('option', { name: '2026/27' })).toHaveLength(1)
    expect(screen.queryByRole('option', { name: '2027/28' })).toBeNull()
    fireEvent.change(academicYearSelect, { target: { value: '2026/27' } })
    fireEvent.change(screen.getByLabelText('Explain the issue'), { target: { value: 'My mark is missing.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }))

    await waitFor(() => {
      expect(createStudentReport).toHaveBeenCalledWith({
        courseUnitId: 'course-1',
        academicYear: '2026/27',
        description: 'My mark is missing.',
      }, [])
    })
  })

  it('shows each attendance requirement when report submission is blocked', async () => {
    getStudentReportOptions.mockResolvedValue({
      success: true,
      data: [{
        id: 'course-1',
        code: 'IN101',
        name: 'Introduction to Computing',
        academicYears: [{ value: '2026/27', label: '2026/27', academicPeriodId: 'period-1' }],
      }],
    })
    createStudentReport.mockRejectedValue({
      userMessage: 'Your report was not submitted because one or more attendance requirements were not met.',
      response: {
        data: {
          details: [
            { path: 'attendance.classAttendance', message: 'Class attendance: not met; attended 3 of 5 sessions (60%; 80% required).' },
            { path: 'attendance.catAttendance', message: 'CAT attendance: met; attendance at at least one CAT session is required.' },
            { path: 'attendance.examAttendance', message: 'Exam attendance: not met; exam attendance is required.' },
          ],
        },
      },
    })

    render(
      <MemoryRouter>
        <StudentReportCreate />
      </MemoryRouter>
    )

    fireEvent.change(await screen.findByLabelText('Course unit'), { target: { value: 'course-1' } })
    fireEvent.change(screen.getByLabelText('Academic year'), { target: { value: '2026/27' } })
    fireEvent.change(screen.getByLabelText('Explain the issue'), { target: { value: 'My mark is missing.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit report' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Your report was not submitted')
    expect(screen.getByRole('heading', { name: 'Your report wasn’t submitted' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Class attendance' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'CAT attendance' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Exam attendance' })).toBeTruthy()
    expect(screen.getByText('1 of 3 checks met')).toBeTruthy()
    expect(screen.getAllByText('Not met').length).toBe(2)
  })
})
