import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LecturerMarks from '../../src/features/lecturer/LecturerMarks'
import CodMarkCorrections from '../../src/features/cod/CodMarkCorrections'
import StudentMarks from '../../src/features/student/StudentMarks'

vi.mock('../../src/api/lecturer', () => ({
  getLecturerMarkOptions: vi.fn(),
  getLecturerAssessmentRoster: vi.fn(),
  submitLecturerMarks: vi.fn(),
}))
vi.mock('../../src/api/cod', () => ({
  getCodDepartments: vi.fn(),
  getCodMarkCorrections: vi.fn(),
  getCodMarkCorrection: vi.fn(),
  decideCodMarkCorrection: vi.fn(),
}))
vi.mock('../../src/api/student', () => ({
  getStudentMarks: vi.fn(),
}))

import {
  getLecturerAssessmentRoster,
  getLecturerMarkOptions,
  submitLecturerMarks,
} from '../../src/api/lecturer'
import {
  decideCodMarkCorrection,
  getCodDepartments,
  getCodMarkCorrection,
  getCodMarkCorrections,
} from '../../src/api/cod'
import { getStudentMarks } from '../../src/api/student'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('mark management interfaces', () => {
  it('lets an assigned lecturer submit initial marks and shows the submitted official value', async () => {
    getLecturerMarkOptions.mockResolvedValue({
      success: true,
      data: [{
        courseUnit: {
          id: 'unit-1',
          code: 'CS101',
          name: 'Computing',
          assessments: [{ id: 'assessment-1', name: 'CAT 1', type: 'CAT', maximumMarks: '100' }],
        },
        academicPeriods: [{ id: 'period-1', name: 'Semester 1', academicYear: '2026/27' }],
      }],
    })
    getLecturerAssessmentRoster
      .mockResolvedValueOnce({
        success: true,
        data: {
          assessment: { name: 'CAT 1', maximumMarks: 100 },
          academicPeriod: { name: 'Semester 1' },
          students: [
            { student: { id: 'student-1', studentNumber: 'CS/00001/26', user: { displayName: 'Alex' } }, mark: null, attendance: { status: 'PRESENT', eligible: true } },
            { student: { id: 'student-2', studentNumber: 'CS/00002/26', user: { displayName: 'Sam' } }, mark: null, attendance: { status: 'ABSENT', eligible: false } },
          ],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          assessment: { name: 'CAT 1', maximumMarks: 100 },
          academicPeriod: { name: 'Semester 1' },
          students: [
            { student: { id: 'student-1', studentNumber: 'CS/00001/26', user: { displayName: 'Alex' } }, mark: { value: '81.00' }, attendance: { status: 'PRESENT', eligible: true } },
            { student: { id: 'student-2', studentNumber: 'CS/00002/26', user: { displayName: 'Sam' } }, mark: null, attendance: { status: 'ABSENT', eligible: false } },
          ],
        },
      })
    submitLecturerMarks.mockResolvedValue({ success: true })

    render(<LecturerMarks />)
    fireEvent.change(await screen.findByLabelText('Course unit'), { target: { value: 'unit-1' } })
    fireEvent.change(screen.getByLabelText('Academic period'), { target: { value: 'period-1' } })
    fireEvent.change(screen.getByLabelText('Assessment'), { target: { value: 'assessment-1' } })
    const markInput = await screen.findByRole('spinbutton', { name: 'Initial mark for CS/00001/26' })
    expect(markInput.step).toBe('1')
    expect(screen.getByLabelText('Incomplete mark for CS/00002/26').value).toBe('**')
    expect(screen.getByLabelText('Incomplete mark for CS/00002/26').disabled).toBe(true)
    fireEvent.change(markInput, { target: { value: '81.5' } })
    fireEvent.submit(markInput.closest('form'))
    expect(await screen.findByText('Marks must be whole numbers.')).toBeTruthy()
    expect(submitLecturerMarks).not.toHaveBeenCalled()
    fireEvent.change(markInput, { target: { value: '81' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit initial marks' }))

    await waitFor(() => expect(submitLecturerMarks).toHaveBeenCalledWith('assessment-1', {
      academicPeriodId: 'period-1',
      marks: [{ studentProfileId: 'student-1', value: 81 }],
    }))
    expect(await screen.findByText('81')).toBeTruthy()
  })

  it('lets a COD review and reject a correction with comments', async () => {
    const item = {
      id: 'correction-1',
      status: 'PENDING_REVIEW',
      originalValue: '50.00',
      proposedValue: '70.00',
      baselineVerified: true,
      reason: 'Corrected script score',
      report: {
        reference: 'MM-001',
        student: { studentNumber: 'CS/00001/26', user: { displayName: 'Alex' } },
        courseUnit: { code: 'CS101', name: 'Computing' },
        assessment: { name: 'CAT 1' },
        academicPeriod: { name: 'Semester 1' },
      },
    }
    getCodDepartments.mockResolvedValue({ success: true, data: [{ id: 'department-1', name: 'Computing' }] })
    getCodMarkCorrections.mockResolvedValue({ success: true, data: [item] })
    getCodMarkCorrection.mockResolvedValue({ success: true, data: item })
    decideCodMarkCorrection.mockResolvedValue({ success: true })

    render(<CodMarkCorrections />)
    fireEvent.click(await screen.findByRole('button', { name: 'Review' }))
    expect(await screen.findByText('50')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Review comments'), { target: { value: 'Evidence does not support the change.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
    await waitFor(() => expect(decideCodMarkCorrection).toHaveBeenCalledWith('correction-1', {
      decision: 'REJECT',
      comments: 'Evidence does not support the change.',
    }))
  })

  it('shows only the authenticated student marks supplied by the API and filters by period', async () => {
    getStudentMarks.mockResolvedValue({
      success: true,
      data: [{
        id: 'mark-1',
        value: '88.50',
        assessment: { code: 'CAT1', name: 'CAT 1', type: 'CAT', maximumMarks: '100', courseUnit: { code: 'CS101', name: 'Computing' } },
        enrollment: { academicPeriod: { id: 'period-1', name: 'Semester 1', startsAt: '2026-09-01T00:00:00.000Z' } },
      }],
    })
    render(<StudentMarks />)
    expect(await screen.findByText('88.50')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Academic period'), { target: { value: 'period-1' } })
    expect(screen.getByText('CS101 · Computing')).toBeTruthy()
    expect(getStudentMarks).toHaveBeenCalledWith()
  })
})
