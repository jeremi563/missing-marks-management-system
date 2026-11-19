import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AccountSettings from '../../src/features/shared/AccountSettings'

vi.mock('../../src/api/auth', () => ({
  changePassword: vi.fn(),
  requestEmailChange: vi.fn(),
  updateAvatar: vi.fn(),
}))

vi.mock('../../src/api/lecturer', () => ({
  getLecturerDepartments: vi.fn(),
}))

vi.mock('../../src/auth/useAuth', () => ({
  useAuth: () => ({
    user: { displayName: 'Morgan Lecturer', email: 'morgan@example.test' },
    refreshUser: vi.fn(),
  }),
}))

import { getLecturerDepartments } from '../../src/api/lecturer'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AccountSettings', () => {
  it('shows department codes for lecturer accounts', async () => {
    getLecturerDepartments.mockResolvedValue({
      success: true,
      data: {
        assignedDepartments: [
          { id: 'department-1', name: 'Computing', code: 'COMP', initials: 'IN' },
          { id: 'department-2', name: 'Engineering', code: null, initials: 'EN' },
        ],
      },
    })

    render(<AccountSettings roleLabel="Lecturer" />)

    expect(await screen.findByText('COMP')).toBeTruthy()
    expect(screen.getByText('EN')).toBeTruthy()
    expect(getLecturerDepartments).toHaveBeenCalledOnce()
  })
})
