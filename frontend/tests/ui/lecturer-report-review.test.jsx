import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ReportReviewPanel from '../../src/features/lecturer/ReportReviewPanel'

vi.mock('../../src/api/lecturer', () => ({
  addLecturerReportComment: vi.fn(),
  decideLecturerReport: vi.fn(),
  escalateLecturerReport: vi.fn(),
  getLecturerAssessmentTypes: vi.fn(),
  getLecturerReport: vi.fn(),
  getLecturerReportComments: vi.fn(),
  submitLecturerCorrection: vi.fn(),
}))

import {
  addLecturerReportComment,
  decideLecturerReport,
  getLecturerAssessmentTypes,
  getLecturerReport,
  getLecturerReportComments,
} from '../../src/api/lecturer'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ReportReviewPanel', () => {
  it('shows the automatic attendance checks and sends student-visible feedback', async () => {
    getLecturerReport.mockResolvedValue({
      success: true,
      data: {
        reference: 'MM-2026-ABCDEF0123',
        status: 'PENDING',
        description: 'CAT 1 mark missing',
        courseUnit: { code: 'IN101', name: 'Computing' },
        student: { studentNumber: 'IN/01234/2026' },
        attendanceReview: {
          academicYear: '2026/27',
          assessments: {
            CAT: { status: 'absent', items: [{ assessmentId: 'cat-1', code: 'CAT 1', status: 'absent' }] },
            EXAM: { status: 'present', items: [{ assessmentId: 'exam-1', code: 'EXAM', status: 'present' }] },
          },
          classAttendance: {
            attendedSessions: 4,
            applicableSessions: 5,
            percentage: 80,
            minimumPercentage: 80,
            meetsRequirement: true,
          },
        },
      },
    })
    getLecturerReportComments.mockResolvedValue({ success: true, data: [] })
    getLecturerAssessmentTypes.mockResolvedValue({ success: true, data: [{ id: 'type-1', name: 'CAT' }] })
    addLecturerReportComment.mockResolvedValue({ success: true, data: { id: 'comment-1' } })

    render(<ReportReviewPanel reportId="report-1" onClose={vi.fn()} />)

    expect(await screen.findByText('Attendance review')).not.toBeNull()
    expect(screen.getByText('CAT attendance')).not.toBeNull()
    expect(screen.getByText('Not present')).not.toBeNull()
    expect(screen.getByText('Exam attendance')).not.toBeNull()
    expect(screen.getByLabelText('What assessment was missed?')).not.toBeNull()
    expect(screen.queryByLabelText('Assessment type UUID')).toBeNull()
    expect(screen.getByText('4 of 5 sessions · meets the 80% threshold')).not.toBeNull()

    fireEvent.change(screen.getByPlaceholderText('Share relevant feedback or information'), {
      target: { value: 'Please contact me about your CAT attendance record.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }))

    await waitFor(() => {
      expect(addLecturerReportComment).toHaveBeenCalledWith(
        'report-1',
        'Please contact me about your CAT attendance record.',
      )
    })
  })

  it('uses a readable assessment dropdown and explains Other before recording a decision', async () => {
    getLecturerReport.mockResolvedValue({
      success: true,
      data: { reference: 'MM-2026-ABCDEF0123', status: 'PENDING', description: 'Missing mark' },
    })
    getLecturerReportComments.mockResolvedValue({ success: true, data: [] })
    getLecturerAssessmentTypes.mockResolvedValue({
      success: true,
      data: [{ id: 'other-type-id', code: 'OTHER', name: 'Other' }],
    })
    decideLecturerReport.mockResolvedValue({ success: true })

    render(<ReportReviewPanel reportId="report-1" onClose={vi.fn()} />)

    const assessmentSelect = await screen.findByLabelText('What assessment was missed?')
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Reviewed the submitted details.' } })
    fireEvent.change(assessmentSelect, { target: { value: 'other-type-id' } })
    fireEvent.change(screen.getByLabelText('Describe the assessment'), { target: { value: 'Practical test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))

    await waitFor(() => {
      expect(decideLecturerReport).toHaveBeenCalledWith('report-1', {
        decision: 'APPROVE',
        reason: 'Reviewed the submitted details.',
        assessmentTypeId: 'other-type-id',
        assessmentTypeOtherDescription: 'Practical test',
      })
    })
  })

  it('does not request a UUID when assessment choices are unavailable', async () => {
    getLecturerReport.mockResolvedValue({ success: true, data: { status: 'PENDING' } })
    getLecturerReportComments.mockResolvedValue({ success: true, data: [] })
    getLecturerAssessmentTypes.mockResolvedValue({ success: true, data: [] })

    render(<ReportReviewPanel reportId="report-1" onClose={vi.fn()} />)

    expect(await screen.findByLabelText('What assessment was missed?')).not.toBeNull()
    expect(screen.getByRole('status').textContent).toContain('Assessment options are unavailable')
    expect(screen.queryByLabelText('Assessment type UUID')).toBeNull()
    expect(screen.getByRole('button', { name: 'Approve' }).disabled).toBe(true)
  })
})
