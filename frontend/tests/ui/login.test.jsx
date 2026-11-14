import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import FirstLoginPasswordChange from '../../src/pages/FirstLoginPasswordChange'
import LoginPage from '../../src/pages/LoginPage'

vi.mock('../../src/auth/useAuth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../../src/api/auth', () => ({
  changePassword: vi.fn(),
}))

import { useAuth } from '../../src/auth/useAuth'
import { changePassword } from '../../src/api/auth'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{JSON.stringify({
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
    state: location.state ?? null,
  })}</output>
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('login flow', () => {
  it.each([
    {
      tab: 'Student',
      accountType: 'student',
      identifierLabel: 'Registration number',
      identifier: 'AB/0123/STAFF9',
    },
    {
      tab: 'Staff',
      accountType: 'staff',
      identifierLabel: 'Staff number',
      identifier: 'IN16/01243/26',
    },
  ])('rejects invalid credentials when the $tab tab is selected', async ({
    tab,
    accountType,
    identifierLabel,
    identifier,
  }) => {
    const login = vi.fn().mockRejectedValue({ userMessage: 'Invalid identifier or password' })
    useAuth.mockReturnValue({ login, isAuthenticated: false, user: null })

    const { container } = render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(container.querySelectorAll('.login-input-icon')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: tab }))
    fireEvent.change(screen.getByLabelText(identifierLabel), { target: { value: identifier } })
    expect(container.querySelectorAll('.login-input-icon')).toHaveLength(1)
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'account-password' } })
    expect(container.querySelectorAll('.login-input-icon')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: /Sign in/ }))

    await waitFor(() => expect(login).toHaveBeenCalledWith({
      identifier,
      password: 'account-password',
      accountType,
    }))
    expect((await screen.findByRole('alert')).textContent).toBe('Invalid identifier or password')
    expect(screen.queryByTestId('location')).toBeNull()
  })

  it('preserves the protected destination when first sign-in requires a password change', async () => {
    const login = vi.fn().mockResolvedValue({ mustChangePassword: true })
    useAuth.mockReturnValue({ login, isAuthenticated: false, user: null })
    const state = {
      from: {
        pathname: '/student/reports',
        search: '?status=missing',
        hash: '#recent',
      },
    }

    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/change-password" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText('Registration number'), { target: { value: ' STU-001 ' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'temporary-password' } })
    expect(screen.getByLabelText('Password').maxLength).toBe(128)
    fireEvent.click(screen.getByRole('button', { name: /Sign in/ }))

    await waitFor(() => expect(login).toHaveBeenCalledWith({
      identifier: 'STU-001',
      password: 'temporary-password',
      accountType: 'student',
    }))
    expect(JSON.parse((await screen.findByTestId('location')).textContent)).toEqual({
      pathname: '/change-password',
      search: '',
      hash: '',
      state,
    })
  })

  it('switches the identifier label between student and staff', () => {
    useAuth.mockReturnValue({ login: vi.fn(), isAuthenticated: false, user: null })

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByLabelText('Registration number')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Staff' }))
    expect(screen.getByLabelText('Staff number')).toBeTruthy()
  })

  it('returns to the full protected destination after the temporary password is changed', async () => {
    useAuth.mockReturnValue({
      refreshUser: vi.fn().mockResolvedValue({ roles: ['student'] }),
      user: { email: 'student@example.test' },
    })
    changePassword.mockResolvedValue({ success: true })
    const state = {
      from: {
        pathname: '/student/reports',
        search: '?status=missing',
        hash: '#recent',
      },
    }

    render(
      <MemoryRouter initialEntries={[{ pathname: '/change-password', state }]}>
        <Routes>
          <Route path="/change-password" element={<FirstLoginPasswordChange />} />
          <Route path="/student/reports" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText('Temporary password'), { target: { value: 'temporary-password' } })
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Password123' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/at least one letter, one number, and one special character/i)
    expect(changePassword).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password-123' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'new-password-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }))

    await waitFor(() => expect(changePassword).toHaveBeenCalledWith('temporary-password', 'new-password-123'))
    expect(JSON.parse((await screen.findByTestId('location')).textContent)).toEqual({
      pathname: '/student/reports',
      search: '?status=missing',
      hash: '#recent',
      state: null,
    })
  })

  it('sends a first-login account to its own dashboard when the saved destination is for another role', async () => {
    useAuth.mockReturnValue({
      refreshUser: vi.fn().mockResolvedValue({ roles: ['lecturer'] }),
      user: { email: 'lecturer@example.test' },
    })
    changePassword.mockResolvedValue({ success: true })

    render(
      <MemoryRouter initialEntries={[{
        pathname: '/change-password',
        state: { from: { pathname: '/student/reports' } },
      }]}>
        <Routes>
          <Route path="/change-password" element={<FirstLoginPasswordChange />} />
          <Route path="/lecturer" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText('Temporary password'), { target: { value: 'temporary-password' } })
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password-123' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'new-password-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }))

    expect(JSON.parse((await screen.findByTestId('location')).textContent).pathname).toBe('/lecturer')
  })
})
