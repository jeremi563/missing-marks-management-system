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
})
