import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EnrollmentRequestInbox from '../../src/features/shared/EnrollmentRequestInbox'

vi.mock('../../src/api/lecturer', () => ({
  getLecturerEnrollmentRequests: vi.fn(),
  decideLecturerEnrollmentRequests: vi.fn(),
}))

vi.mock('../../src/api/cod', () => ({
  getCodEnrollmentRequests: vi.fn(),
  decideCodEnrollmentRequests: vi.fn(),
}))

import {
  decideLecturerEnrollmentRequests,
  getLecturerEnrollmentRequests,
} from '../../src/api/lecturer'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('EnrollmentRequestInbox', () => {
  it('lets a lecturer approve all selected pending requests in one action', async () => {
    const requests = [
      {
        id: 'request-1',
        status: 'PENDING',
        student: { studentNumber: 'IN/100/2026', user: { displayName: 'Sam Student' } },
        courseUnit: { code: 'IN101', name: 'Computing', department: { name: 'Information Technology' } },
        academicPeriod: { name: '2026/27' },
      },
      {
        id: 'request-2',
        status: 'PENDING',
        student: { studentNumber: 'IN/101/2026', user: { displayName: 'Alex Student' } },
        courseUnit: { code: 'IN102', name: 'Networks', department: { name: 'Information Technology' } },
        academicPeriod: { name: '2026/27' },
      },
    ]
    getLecturerEnrollmentRequests.mockResolvedValue({ success: true, data: requests })
    decideLecturerEnrollmentRequests.mockResolvedValue({ success: true, data: { count: 2, status: 'APPROVED' } })
    render(<EnrollmentRequestInbox audience="lecturer" />)

    expect(await screen.findByText('Sam Student')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: /Select all pending/ }))
    fireEvent.click(screen.getByRole('button', { name: /Approve selected/ }))
    expect(await screen.findByRole('alertdialog', { name: 'Approve enrollment requests?' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Approve requests' }))

    await waitFor(() => {
      expect(decideLecturerEnrollmentRequests).toHaveBeenCalledWith({
        requestIds: ['request-1', 'request-2'],
        decision: 'APPROVE',
      })
    })
    expect(await screen.findByRole('status')).toBeTruthy()
  })
})
