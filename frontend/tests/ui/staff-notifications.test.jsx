import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StaffNotifications from '../../src/features/shared/StaffNotifications'

vi.mock('../../src/api/lecturer', () => ({
  getLecturerNotifications: vi.fn(),
  markAllLecturerNotificationsRead: vi.fn(),
  markLecturerNotificationRead: vi.fn(),
}))

vi.mock('../../src/api/cod', () => ({
  getCodNotifications: vi.fn(),
  markAllCodNotificationsRead: vi.fn(),
  markCodNotificationRead: vi.fn(),
}))

import { getCodNotifications, markAllCodNotificationsRead } from '../../src/api/cod'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('StaffNotifications', () => {
  it('lets COD mark all notifications read with the bulk action', async () => {
    getCodNotifications.mockResolvedValue({
      success: true,
      data: {
        notifications: [{ id: 'notice-1', title: 'New missing-mark report', message: 'A report was submitted.', readAt: null, createdAt: '2026-11-12T10:00:00Z' }],
        unreadCount: 1,
        pagination: { page: 1, totalPages: 1 },
      },
    })
    markAllCodNotificationsRead.mockResolvedValue({ success: true, data: { updatedCount: 1 } })

    render(<StaffNotifications audience="cod" />)
    expect(await screen.findByText('New missing-mark report')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Mark all as read/ }))

    await waitFor(() => expect(markAllCodNotificationsRead).toHaveBeenCalledOnce())
    await waitFor(() => expect(getCodNotifications).toHaveBeenCalledTimes(2))
  })
})
