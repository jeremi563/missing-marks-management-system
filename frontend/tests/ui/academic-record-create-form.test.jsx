import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AcademicRecordCreateForm from '../../src/features/admin/AcademicRecordCreateForm'

vi.mock('../../src/api/admin', () => ({
  createAdminAcademicPeriod: vi.fn(),
  createAdminAssessment: vi.fn(),
  createAdminClassroom: vi.fn(),
  createAdminCourse: vi.fn(),
  createAdminCourseUnit: vi.fn(),
  getAdminCourses: vi.fn(),
  getAdminCourseUnits: vi.fn(),
  getAdminDepartments: vi.fn(),
}))

import {
  createAdminCourseUnit,
  getAdminCourses,
  getAdminDepartments,
} from '../../src/api/admin'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AcademicRecordCreateForm', () => {
  it('filters course-unit options by department and clears the course when department changes', async () => {
    getAdminDepartments.mockResolvedValue({
      success: true,
      data: {
        departments: [
          { id: 'department-in', name: 'Information Technology' },
          { id: 'department-en', name: 'Engineering' },
        ],
      },
    })
    getAdminCourses.mockResolvedValue({
      success: true,
      data: {
        courses: [
          { id: 'course-in', code: '16', name: 'Computing', department: { id: 'department-in' } },
          { id: 'course-en', code: '24', name: 'Electrical Engineering', department: { id: 'department-en' } },
        ],
      },
    })

    render(<AcademicRecordCreateForm resourceKey="units" onCreated={vi.fn()} />)

    const departmentSelect = await screen.findByLabelText('Department')
    const courseSelect = screen.getByLabelText('Course')
    expect(courseSelect.disabled).toBe(true)

    fireEvent.change(departmentSelect, { target: { value: 'department-in' } })
    expect(screen.getByRole('option', { name: '16 — Computing' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: '24 — Electrical Engineering' })).toBeNull()

    fireEvent.change(courseSelect, { target: { value: 'course-in' } })
    fireEvent.change(departmentSelect, { target: { value: 'department-en' } })
    expect(courseSelect.value).toBe('')
    expect(screen.getByRole('option', { name: '24 — Electrical Engineering' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: '16 — Computing' })).toBeNull()
  })

  it('submits the selected course without sending the UI-only department filter', async () => {
    getAdminDepartments.mockResolvedValue({
      success: true,
      data: { departments: [{ id: 'department-in', name: 'Information Technology' }] },
    })
    getAdminCourses.mockResolvedValue({
      success: true,
      data: {
        courses: [{ id: 'course-in', code: '16', name: 'Computing', department: { id: 'department-in' } }],
      },
    })
    createAdminCourseUnit.mockResolvedValue({ success: true })

    render(<AcademicRecordCreateForm resourceKey="units" onCreated={vi.fn()} />)
    fireEvent.change(await screen.findByLabelText('Department'), { target: { value: 'department-in' } })
    fireEvent.change(screen.getByLabelText('Course'), { target: { value: 'course-in' } })
    fireEvent.change(screen.getByLabelText('Course-unit code'), { target: { value: 'IN101' } })
    fireEvent.change(screen.getByLabelText('Course-unit name'), { target: { value: 'Introduction to Computing' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create course unit' }))

    await waitFor(() => expect(createAdminCourseUnit).toHaveBeenCalledWith({
      courseId: 'course-in',
      code: 'IN101',
      name: 'Introduction to Computing',
    }))
  })
})
