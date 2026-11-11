import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StudentReportDetails from '../../src/features/student/StudentReportDetails'

vi.mock('../../src/api/student', () => ({
  getStudentReport: vi.fn(),
  getStudentReportComments: vi.fn(),
  addStudentReportComment: vi.fn(),
  updateStudentReport: vi.fn(),
  withdrawStudentReport: vi.fn(),
}))

import {
  addStudentReportComment,
  getStudentReport,
  getStudentReportComments,
  updateStudentReport,
  withdrawStudentReport,
} from '../../src/api/student'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('StudentReportDetails', () => {
  it('renders the report timeline and submits a trimmed clarification comment', async () => {
    getStudentReport.mockResolvedValue({
      data: {
        data: {
          id: 'report-1',
          reference: 'MM-001',
          status: 'Submitted',
          description: 'Missing CAT mark',
          courseUnit: { name: 'Programming' },
          academicPeriod: { name: 'Semester 1' },
          statusHistory: [
            {
              id: 'status-1',
              newStatus: 'Submitted',
              createdAt: '2026-10-01T10:00:00.000Z',
            },
          ],
        },
      },
    })
    getStudentReportComments
      .mockResolvedValueOnce({ data: { data: [] } })
      .mockResolvedValueOnce({
        data: {
          data: [{ id: 'comment-1', body: 'I attended the assessment.' }],
        },
      })

    render(
      <MemoryRouter initialEntries={['/student/reports/report-1']}>
        <Routes>
          <Route
            path="/student/reports/:reportId"
            element={<StudentReportDetails />}
          />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Missing CAT mark')).toBeTruthy()
    expect(screen.getAllByText('Submitted')).toHaveLength(2)

    fireEvent.change(
      screen.getByPlaceholderText('Enter your comment or clarification...'),
      { target: { value: '  I attended the assessment.  ' } }
    )
    fireEvent.click(screen.getByRole('button', { name: 'Submit Comment' }))

    expect(await screen.findByText('I attended the assessment.')).toBeTruthy()
    expect(addStudentReportComment).toHaveBeenCalledWith(
      'report-1',
      'I attended the assessment.'
    )
  })

  it('allows editing a submitted report', async () => {
    getStudentReport.mockResolvedValue({
      data: {
        data: {
          id: 'report-1',
          status: 'Submitted',
          assessmentComponent: 'CAT 1',
          description: 'Original description',
        },
      },
    })
    getStudentReportComments.mockResolvedValue({ data: { data: [] } })
    updateStudentReport.mockResolvedValue({
      data: {
        data: {
          assessmentComponent: 'CAT 2',
          description: 'Updated description',
        },
      },
    })

    render(
      <MemoryRouter initialEntries={['/student/reports/report-1']}>
        <Routes>
          <Route
            path="/student/reports/:reportId"
            element={<StudentReportDetails />}
          />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Edit report' }))
    fireEvent.change(screen.getByLabelText('Assessment component'), {
      target: { value: 'CAT 2' },
    })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Updated description' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Updated description')).toBeTruthy()
    expect(updateStudentReport).toHaveBeenCalledWith('report-1', {
      assessmentComponent: 'CAT 2',
      description: 'Updated description',
    })
  })

  it('hides edit and withdraw actions when a report is no longer submitted', async () => {
    getStudentReport.mockResolvedValue({
      data: { data: { id: 'report-2', status: 'PENDING', description: 'In review' } },
    })
    render(
      <MemoryRouter initialEntries={['/student/reports/report-2']}>
        <Routes>
          <Route
            path="/student/reports/:reportId"
            element={<StudentReportDetails />}
          />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('In review')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Edit report' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Withdraw report' })).toBeNull()
    expect(withdrawStudentReport).not.toHaveBeenCalled()
  })

  it('requires confirmation before withdrawing a submitted report', async () => {
    getStudentReport.mockResolvedValue({
      data: { data: { id: 'report-3', status: 'Submitted', description: 'To withdraw' } },
    })
    getStudentReportComments.mockResolvedValue({ data: { data: [] } })
    withdrawStudentReport.mockResolvedValue({
      data: { data: { status: 'Withdrawn' } },
    })

    render(
      <MemoryRouter initialEntries={['/student/reports/report-3']}>
        <Routes>
          <Route
            path="/student/reports/:reportId"
            element={<StudentReportDetails />}
          />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw report' }))
    expect(await screen.findByRole('alertdialog')).toBeTruthy()
    expect(withdrawStudentReport).not.toHaveBeenCalled()

    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Withdraw report',
      })
    )

    expect(await screen.findByText('Withdrawn')).toBeTruthy()
    expect(withdrawStudentReport).toHaveBeenCalledWith('report-3')
  })
})