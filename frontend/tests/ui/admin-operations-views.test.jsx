import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AdminAuditLogs from '../../src/features/admin/AdminAuditLogs'
import AdminReports from '../../src/features/admin/AdminReports'

vi.mock('../../src/api/admin', () => ({
  getAdminAcademicPeriods: vi.fn(),
  getAdminAuditLogs: vi.fn(),
  getAdminCourseUnits: vi.fn(),
  getAdminDepartments: vi.fn(),
  getAdminReports: vi.fn(),
}))

import {
  getAdminAcademicPeriods,
  getAdminAuditLogs,
  getAdminCourseUnits,
  getAdminDepartments,
  getAdminReports,
} from '../../src/api/admin'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('administrator report and audit views', () => {
  it('loads reports and applies department and status filters through the existing API', async () => {
    getAdminDepartments.mockResolvedValue({
      data: [{ id: 'department-1', code: 'CS', name: 'Computing' }],
      pagination: { totalPages: 1 },
    })
    getAdminCourseUnits.mockResolvedValue({
      data: [{ id: 'unit-1', departmentId: 'department-1', code: 'CS101', name: 'Foundations' }],
      pagination: { totalPages: 1 },
    })
    getAdminAcademicPeriods.mockResolvedValue({ data: [], pagination: { totalPages: 0 } })
    getAdminReports.mockResolvedValue({
      data: {
        reports: [{
          id: 'report-1',
          reference: 'MM-001',
          status: 'PENDING',
          courseUnit: { code: 'CS101', name: 'Foundations', department: { code: 'CS' } },
          academicPeriod: { name: 'Semester One' },
          assignedLecturer: { user: { displayName: 'Alex Lecturer' } },
          createdAt: '2026-11-16T10:00:00.000Z',
        }],
        summary: { total: 1, byStatus: [{ status: 'PENDING', count: 1 }] },
      },
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })

    render(<AdminReports />)

    expect(await screen.findByRole('cell', { name: 'MM-001' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'PENDING' } })
    fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'department-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))

    await waitFor(() => expect(getAdminReports).toHaveBeenLastCalledWith({
      page: 1,
      limit: 20,
      status: 'PENDING',
      departmentId: 'department-1',
    }))
  })

  it('shows an empty state when no reports match', async () => {
    getAdminDepartments.mockResolvedValue({ data: [], pagination: { totalPages: 0 } })
    getAdminCourseUnits.mockResolvedValue({ data: [], pagination: { totalPages: 0 } })
    getAdminAcademicPeriods.mockResolvedValue({ data: [], pagination: { totalPages: 0 } })
    getAdminReports.mockResolvedValue({
      data: { reports: [], summary: { total: 0, byStatus: [] } },
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    })

    render(<AdminReports />)

    expect(await screen.findByText('No missing-mark reports match the applied filters.')).toBeTruthy()
  })

  it('loads audit events and validates actor IDs before applying filters', async () => {
    getAdminAuditLogs.mockResolvedValue({
      data: [{
        id: 'audit-1',
        action: 'ADMIN_REPORT_REOPENED',
        entityType: 'MissingMarkReport',
        entityId: 'report-1',
        metadata: { previousStatus: 'REJECTED', newStatus: 'PENDING' },
        createdAt: '2026-11-16T10:00:00.000Z',
        actor: { displayName: 'Administrator' },
      }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    })

    render(<AdminAuditLogs />)

    expect(await screen.findByRole('cell', { name: 'ADMIN_REPORT_REOPENED' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Actor ID'), { target: { value: 'not-a-uuid' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Actor ID must be a valid UUID.')
    expect(getAdminAuditLogs).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByLabelText('Actor ID'), { target: { value: '123e4567-e89b-42d3-a456-426614174000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }))

    await waitFor(() => expect(getAdminAuditLogs).toHaveBeenLastCalledWith({
      page: 1,
      limit: 20,
      actorId: '123e4567-e89b-42d3-a456-426614174000',
    }))
  })
})
