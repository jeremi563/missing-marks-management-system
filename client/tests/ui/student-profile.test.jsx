import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StudentProfile from '../../src/features/student/StudentProfile'

vi.mock('../../src/api/student', () => ({
  getStudentProfile: vi.fn(),
}))

import { getStudentProfile } from '../../src/api/student'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('StudentProfile', () => {
  it('renders the authenticated student profile from a mocked API response', async () => {
    getStudentProfile.mockResolvedValue({
      data: {
        id: 'student-profile-1',
        studentNumber: 'STU-001',
        officialEmail: 'student@university.test',
        user: {
          displayName: 'Taylor Student',
          email: 'taylor@example.test',
        },
      },
    })

    render(<StudentProfile />)

    expect(await screen.findByRole('heading', { name: 'My Profile' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Taylor Student' })).toBeTruthy()
    expect(screen.getAllByText('STU-001')).toHaveLength(2)
    expect(screen.getByText('student@university.test')).toBeTruthy()
    expect(getStudentProfile).toHaveBeenCalledOnce()
  })
})