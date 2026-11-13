import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ForgotPasswordPage from '../../src/pages/ForgotPasswordPage'
import ResetPasswordPage from '../../src/pages/ResetPasswordPage'

vi.mock('../../src/api/auth', () => ({
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}))

import { requestPasswordReset, resetPassword } from '../../src/api/auth'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('password recovery pages', () => {
  it('shows the same generic confirmation after requesting a reset link', async () => {
    requestPasswordReset.mockResolvedValue({ success: true })

    render(<MemoryRouter><ForgotPasswordPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: ' person@example.test ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledWith('person@example.test'))
    expect(await screen.findByText(/If an account exists for this email address/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Return to sign in/ })).toBeTruthy()
  })

  it('updates the password only when the confirmation matches', async () => {
    resetPassword.mockResolvedValue({ success: true })

    render(<MemoryRouter initialEntries={['/reset-password?token=valid-reset-token']}><ResetPasswordPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password-123' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'different-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))

    expect(await screen.findByText(/passwords do not match/i)).toBeTruthy()
    expect(resetPassword).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'new-password-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))
    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith('valid-reset-token', 'new-password-123'))
    expect(await screen.findByText('You can sign in now')).toBeTruthy()
  })

  it('offers a new reset request when the link has no token', () => {
    render(<MemoryRouter initialEntries={['/reset-password']}><ResetPasswordPage /></MemoryRouter>)

    expect(screen.getByRole('alert').textContent).toMatch(/missing its security token/i)
    expect(screen.getByRole('link', { name: 'Request a new reset link' })).toBeTruthy()
    expect(resetPassword).not.toHaveBeenCalled()
  })
})