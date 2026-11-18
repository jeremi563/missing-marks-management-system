import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AcademicRecordCreateForm from '../../src/features/admin/AcademicRecordCreateForm'

vi.mock('../../src/api/admin', () => ({
  createAdminAcademicPeriod: vi.fn(),
  createAdminAssessment: vi.fn(),
  createAdminClassroom: vi.fn(),
  createAdminCourseUnit: vi.fn(),
  getAdminCourseUnits: vi.fn(),
  getAdminDepartments: vi.fn(),
}))

import {
  createAdminAssessment,
  createAdminClassroom,
  getAdminCourseUnits,
} from '../../src/api/admin'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AcademicRecordCreateForm', () => {
  it('creates an active classroom with GPS location and boundary settings', async () => {
    const onCreated = vi.fn()
    createAdminClassroom.mockResolvedValue({ success: true })

    render(<AcademicRecordCreateForm resourceKey="classrooms" onCreated={onCreated} />)

    fireEvent.change(screen.getByLabelText('Classroom name'), { target: { value: 'Block A, Room 12' } })
    fireEvent.change(screen.getByLabelText('GPS latitude'), { target: { value: '-1.2864' } })
    fireEvent.change(screen.getByLabelText('GPS longitude'), { target: { value: '36.8172' } })
    fireEvent.change(screen.getByLabelText('GPS boundary (metres)'), { target: { value: '80' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create classroom' }))

    await waitFor(() => {
      expect(createAdminClassroom).toHaveBeenCalledWith({
        name: 'Block A, Room 12',
        latitude: -1.2864,
        longitude: 36.8172,
        boundaryMeters: 80,
        isActive: true,
      })
    })
    expect(onCreated).toHaveBeenCalledOnce()
  })

  it('creates CAT 1 or CAT 2 with consistent assessment code and type', async () => {
    getAdminCourseUnits.mockResolvedValue({
      success: true,
      data: { items: [{ id: 'course-1', code: 'IN101', name: 'Computing' }] },
    })
    createAdminAssessment.mockResolvedValue({ success: true })

    render(<AcademicRecordCreateForm resourceKey="assessments" onCreated={vi.fn()} />)

    fireEvent.change(await screen.findByLabelText('Course unit'), { target: { value: 'course-1' } })
    fireEvent.change(screen.getByLabelText('CAT number'), { target: { value: '2' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Create assessment' }).closest('form'))

    await waitFor(() => {
      expect(createAdminAssessment).toHaveBeenCalledWith({
        courseUnitId: 'course-1',
        name: 'CAT 2',
        type: 'CAT',
        code: 'CAT2',
        requiredForEligibility: false,
        attendanceRequired: false,
        submissionRequired: false,
      })
    })
  })

  it('creates an exam with normalized type and all configured assessment inputs', async () => {
      getAdminCourseUnits.mockResolvedValue({
        success: true,
        data: { items: [{ id: 'course-1', code: 'IN101', name: 'Computing' }] },
      })
      createAdminAssessment.mockResolvedValue({ success: true })

      render(<AcademicRecordCreateForm resourceKey="assessments" onCreated={vi.fn()} />)
      fireEvent.change(await screen.findByLabelText('Course unit'), { target: { value: 'course-1' } })
      fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'EXAM' } })
      fireEvent.change(screen.getByLabelText('Assessment name'), { target: { value: 'Main exam' } })
      fireEvent.change(screen.getByLabelText('Assessment code (optional)'), { target: { value: 'EXAM1' } })
      fireEvent.change(screen.getByLabelText('Date (optional)'), { target: { value: '2026-11-16' } })
      fireEvent.change(screen.getByLabelText('Maximum marks (optional)'), { target: { value: '70' } })
      fireEvent.click(screen.getByLabelText('Required for eligibility'))
      fireEvent.click(screen.getByLabelText('Attendance required'))
      fireEvent.click(screen.getByLabelText('Submission required'))
      fireEvent.submit(screen.getByRole('button', { name: 'Create assessment' }).closest('form'))

      await waitFor(() => {
        expect(createAdminAssessment).toHaveBeenCalledWith({
          courseUnitId: 'course-1',
          name: 'Main exam',
          type: 'EXAM',
          code: 'EXAM1',
          assessmentDate: new Date('2026-11-16T00:00:00.000Z').toISOString(),
          maximumMarks: 70,
          requiredForEligibility: true,
          attendanceRequired: true,
          submissionRequired: true,
      })
    })
  })

  it('preserves custom assessment types through the Other option', async () => {
    getAdminCourseUnits.mockResolvedValue({
      success: true,
      data: { items: [{ id: 'course-1', code: 'IN101', name: 'Computing' }] },
    })
    createAdminAssessment.mockResolvedValue({ success: true })

    render(<AcademicRecordCreateForm resourceKey="assessments" onCreated={vi.fn()} />)
    fireEvent.change(await screen.findByLabelText('Course unit'), { target: { value: 'course-1' } })
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'OTHER' } })
    fireEvent.change(screen.getByLabelText('Other assessment type'), { target: { value: 'ASSIGNMENT' } })
    fireEvent.change(screen.getByLabelText('Assessment name'), { target: { value: 'Assignment 1' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Create assessment' }).closest('form'))

    await waitFor(() => {
      expect(createAdminAssessment).toHaveBeenCalledWith(expect.objectContaining({
        courseUnitId: 'course-1',
        name: 'Assignment 1',
        type: 'ASSIGNMENT',
      }))
    })
  })
})
