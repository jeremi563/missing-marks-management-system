import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import LecturerDepartmentRegistration from '../../src/pages/LecturerDepartmentRegistration'

vi.mock('../../src/api/auth', () => ({
  getRegistrationDepartments: vi.fn(),
  registerLecturerDepartment: vi.fn(),
}))

vi.mock('../../src/auth/useAuth', () => ({
  useAuth: () => ({
    user: { roles: ['lecturer'], approvalStatus: 'PENDING' },
    isAuthenticated: true,
    isLoading: false,
  }),
}))

import { getRegistrationDepartments, registerLecturerDepartment } from '../../src/api/auth'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('LecturerDepartmentRegistration', () => {
  it('submits selected departments and the selected primary department', async () => {
    getRegistrationDepartments.mockResolvedValue({
      success: true,
      data: {
        departments: [
          { id: 'department-in', name: 'Information Technology', code: 'IN' },
          { id: 'department-cb', name: 'Cybersecurity', code: 'CB' },
        ],
      },
    })
    registerLecturerDepartment.mockResolvedValue({ success: true })

    render(
      <MemoryRouter>
        <LecturerDepartmentRegistration />
      </MemoryRouter>
    )

    fireEvent.change(await screen.findByLabelText('Full name'), { target: { value: 'Alex Lecturer' } })
    fireEvent.change(screen.getByLabelText('Institutional email'), { target: { value: 'alex@example.test' } })
    fireEvent.change(screen.getByLabelText('Staff number'), { target: { value: 'AB/0123/STAFF9' } })
    fireEvent.change(screen.getByLabelText('Password from your first registration'), { target: { value: 'staff-password' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Information Technology/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Cybersecurity/ }))
    fireEvent.click(screen.getAllByRole('radio', { name: 'Primary department' })[1])
    fireEvent.click(screen.getByRole('button', { name: 'Submit for COD approval' }))

    await waitFor(() => {
      expect(registerLecturerDepartment).toHaveBeenCalledWith({
        displayName: 'Alex Lecturer',
        email: 'alex@example.test',
        registrationNumber: 'AB/0123/STAFF9',
        password: 'staff-password',
        departmentIds: ['department-in', 'department-cb'],
        primaryDepartmentId: 'department-cb',
      })
    })
    expect(await screen.findByRole('heading', { name: 'Awaiting department COD approval' })).toBeTruthy()
  })
})
