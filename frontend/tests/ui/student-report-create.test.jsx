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
    expect(screen.getByRole('option', { name: 'IN101 — Introduction to Computing' })).toBeTruthy()

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
      })
    })
  })
})
