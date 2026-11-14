import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import StudentDashboard from '../../src/features/student/StudentDashboard'

vi.mock('../../src/api/student', () => ({
  getStudentProfile: vi.fn(),
  getStudentReports: vi.fn(),
}))

import { getStudentProfile, getStudentReports } from '../../src/api/student'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('StudentDashboard', () => {
  it('shows the full name from the student profile beside the welcome message', async () => {
    getStudentProfile.mockResolvedValue({
      success: true,
      data: {
        user: { displayName: 'Taylor Student' },
        studentNumber: 'IN16/00111/26',
      },
    })
    getStudentReports.mockResolvedValue({
      success: true,
      data: { reports: [], pagination: { totalPages: 1 } },
    })

    render(
      <MemoryRouter>
        <StudentDashboard />
      </MemoryRouter>
    )

    expect(await screen.findByRole('heading', { name: 'Welcome, Taylor Student' })).toBeTruthy()
  })
})
