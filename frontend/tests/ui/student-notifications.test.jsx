import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StudentNotifications from '../../src/features/student/StudentNotifications'

vi.mock('../../src/api/student', () => ({
  getStudentNotifications: vi.fn(),
  markAllStudentNotificationsAsRead: vi.fn(),
  markStudentNotificationAsRead: vi.fn(),
}))

import {
  getStudentNotifications,
  markAllStudentNotificationsAsRead,
} from '../../src/api/student'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('StudentNotifications', () => {
  it('uses readAt and marks all notifications read through the bulk endpoint', async () => {
    getStudentNotifications.mockResolvedValue({
      success: true,
      data: [
        { id: 'notice-1', title: 'New report update', message: 'A report was reviewed.', readAt: null },
        { id: 'notice-2', title: 'Previous report update', message: 'A report was received.', readAt: '2026-11-12T10:00:00Z' },
      ],
    })
    markAllStudentNotificationsAsRead.mockResolvedValue({
      success: true,
      data: { updatedCount: 1 },
    })

    render(<StudentNotifications />)

    expect(await screen.findByText('1 unread')).toBeTruthy()
    expect(screen.getByText('Previous report update').closest('.notification-card').className).toContain('read')
    fireEvent.click(screen.getByRole('button', { name: /Mark all as read/ }))

    await waitFor(() => expect(markAllStudentNotificationsAsRead).toHaveBeenCalledOnce())
    expect(await screen.findByText('0 unread')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Mark all as read/ }).disabled).toBe(true)
  })
})
