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
          {
            id: 'enrollment-closed',
            courseUnitId: 'course-enrolled',
            academicPeriodId: 'period-closed',
            courseUnit: { code: 'IN101', name: 'Computing' },
            academicPeriod: { id: 'period-closed', name: 'Semester One', code: 'AY25', academicYear: '2025/26', semester: 1 },
          },
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
    expect(screen.getByText('Enrolled · 2025/26 · Semester 1')).toBeTruthy()
    expect(screen.getByText('IN102')).toBeTruthy()
    expect(screen.getAllByRole('checkbox').every((checkbox) => checkbox.disabled)).toBe(true)
    expect(screen.getByRole('button', { name: 'Request enrollment' }).disabled).toBe(true)
  })

  it('shows and filters enrollment history by academic year and semester', async () => {
    getStudentEnrollmentOptions.mockResolvedValue({
      success: true,
      data: {
        courses: [],
        academicPeriods: [],
        enrollments: [
          {
            id: 'enrollment-1',
            courseUnitId: 'unit-1',
            academicPeriodId: 'period-1',
            createdAt: '2026-09-10T00:00:00.000Z',
            courseUnit: { code: 'IN101', name: 'Computing' },
            academicPeriod: { id: 'period-1', name: 'Semester One', academicYear: '2026/27', semester: 1 },
          },
          {
            id: 'enrollment-2',
            courseUnitId: 'unit-2',
            academicPeriodId: 'period-2',
            createdAt: '2027-01-10T00:00:00.000Z',
            courseUnit: { code: 'IN102', name: 'Networks' },
            academicPeriod: { id: 'period-2', name: 'Semester Two', academicYear: '2026/27', semester: 2 },
          },
        ],
        requests: [],
      },
    })

    render(
      <MemoryRouter>
        <StudentEnrollmentRequests />
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByRole('tab', { name: 'My enrollments 2' }))
    expect(await screen.findByRole('columnheader', { name: 'Academic year' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'Semester 1' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'Semester 2' })).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Filter by academic year and semester'), { target: { value: 'period-1' } })
    expect(screen.getByRole('cell', { name: 'IN101 — Computing' })).toBeTruthy()
    expect(screen.queryByRole('cell', { name: 'IN102 — Networks' })).toBeNull()

    fireEvent.change(screen.getByLabelText('Filter by academic year and semester'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Search enrollment history'), { target: { value: 'Semester 2' } })
    expect(screen.getByRole('cell', { name: 'IN102 — Networks' })).toBeTruthy()
    expect(screen.queryByRole('cell', { name: 'IN101 — Computing' })).toBeNull()
  })
})
