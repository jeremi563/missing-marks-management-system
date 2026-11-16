import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StudentEnrollmentRequests from '../../src/features/student/StudentEnrollmentRequests'

vi.mock('../../src/api/student', () => ({
  getStudentEnrollmentOptions: vi.fn(),
  submitStudentEnrollmentRequests: vi.fn(),
}))

import {
  getStudentEnrollmentOptions,
  submitStudentEnrollmentRequests,
} from '../../src/api/student'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('StudentEnrollmentRequests', () => {
  it('lets students request multiple department courses and tracks the submitted requests', async () => {
    getStudentEnrollmentOptions
      .mockResolvedValueOnce({
        success: true,
        data: {
          courses: [
            { id: 'course-1', code: 'IN101', name: 'Computing', lecturers: [{ displayName: 'Alex Lecturer' }] },
            { id: 'course-2', code: 'IN102', name: 'Networks', lecturers: [{ displayName: 'Jordan Lecturer' }] },
          ],
          academicPeriods: [{ id: 'period-1', name: '2026/27', code: 'AY26', enrollmentOpensAt: '2026-09-01T00:00:00.000Z', enrollmentClosesAt: '2027-02-01T23:59:59.999Z' }],
          enrollments: [],
          requests: [],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          courses: [
            { id: 'course-1', code: 'IN101', name: 'Computing', lecturers: [{ displayName: 'Alex Lecturer' }] },
            { id: 'course-2', code: 'IN102', name: 'Networks', lecturers: [{ displayName: 'Jordan Lecturer' }] },
          ],
          academicPeriods: [{ id: 'period-1', name: '2026/27', code: 'AY26', enrollmentOpensAt: '2026-09-01T00:00:00.000Z', enrollmentClosesAt: '2027-02-01T23:59:59.999Z' }],
          enrollments: [],
          requests: [
            { id: 'request-1', courseUnitId: 'course-1', academicPeriodId: 'period-1', status: 'PENDING', updatedAt: '2026-11-12', courseUnit: { code: 'IN101', name: 'Computing' }, academicPeriod: { name: '2026/27' } },
            { id: 'request-2', courseUnitId: 'course-2', academicPeriodId: 'period-1', status: 'PENDING', updatedAt: '2026-11-12', courseUnit: { code: 'IN102', name: 'Networks' }, academicPeriod: { name: '2026/27' } },
          ],
        },
      })
    submitStudentEnrollmentRequests.mockResolvedValue({ success: true })

    render(
      <MemoryRouter>
        <StudentEnrollmentRequests />
      </MemoryRouter>
    )

    expect(await screen.findByText('Computing')).toBeTruthy()
    const courseCheckboxes = screen.getAllByRole('checkbox')
    fireEvent.click(courseCheckboxes[0])
    fireEvent.click(courseCheckboxes[1])
    fireEvent.click(screen.getByRole('button', { name: 'Request enrollment' }))

    await waitFor(() => {
      expect(submitStudentEnrollmentRequests).toHaveBeenCalledWith({
        academicPeriodId: 'period-1',
        courseUnitIds: ['course-1', 'course-2'],
      })
    })
    expect(await screen.findByText('2 pending')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'My requests 2 pending' }))
    expect(await screen.findByText('IN101')).toBeTruthy()
    expect(screen.getByText('IN102')).toBeTruthy()
  })

  it('lets students browse all department courses while enrollment is closed', async () => {
    getStudentEnrollmentOptions.mockResolvedValue({
      success: true,
      data: {
        courses: [
          { id: 'course-enrolled', code: 'IN101', name: 'Computing', lecturers: [] },
          { id: 'course-not-enrolled', code: 'IN102', name: 'Networks', lecturers: [{ displayName: 'Alex Lecturer' }] },
        ],
        academicPeriods: [],
        enrollments: [
          { courseUnitId: 'course-enrolled', academicPeriodId: 'period-closed', academicPeriod: { name: '2025/26', code: 'AY25' } },
        ],
        requests: [],
      },
    })

    render(
      <MemoryRouter>
        <StudentEnrollmentRequests />
      </MemoryRouter>
    )

    expect(await screen.findByText('Enrollment is closed. Browse your department’s courses here; enrollment is limited to open windows.')).toBeTruthy()
    expect(screen.getByText('Enrolled · AY25')).toBeTruthy()
    expect(screen.getByText('IN102')).toBeTruthy()
    expect(screen.getAllByRole('checkbox').every((checkbox) => checkbox.disabled)).toBe(true)
    expect(screen.getByRole('button', { name: 'Request enrollment' }).disabled).toBe(true)
  })
})
