import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RegisterPage from '../../src/pages/RegisterPage'

const authMocks = vi.hoisted(() => ({
  loginUser: vi.fn(),
  registerUser: vi.fn(),
}))

vi.mock('../../src/api/auth', () => ({
  ...authMocks,
}))

import { loginUser, registerUser } from '../../src/api/auth'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('lecturer registration flow', () => {
  it('opens department registration after account registration without creating a login session', async () => {
    registerUser.mockResolvedValue({
      data: { requiresDepartmentRegistration: true },
    })

    render(
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/lecturer-department-registration" element={<h1>Department registration step</h1>} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Alex Lecturer' } })
    fireEvent.change(screen.getByLabelText('Institutional email'), { target: { value: 'alex@example.test' } })
    fireEvent.change(screen.getByLabelText('Staff number'), { target: { value: 'AB/0123/STAFF9' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'new-password-123' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'new-password-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continue lecturer registration' }))

    expect(await screen.findByRole('heading', { name: 'Department registration step' })).toBeTruthy()
    expect(registerUser).toHaveBeenCalledOnce()
    expect(loginUser).not.toHaveBeenCalled()
  })
})
