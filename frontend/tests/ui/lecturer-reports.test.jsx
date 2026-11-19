import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LecturerReports from '../../src/features/lecturer/LecturerReports'

const { reportState } = vi.hoisted(() => ({
  reportState: {
    report: { id: 'report-1', assignments: [{ workStartedAt: '2026-01-15T10:00:00Z' }] },
  },
}))

vi.mock('../../src/api/lecturer', () => ({
  getLecturerReports: vi.fn(),
  startLecturerReport: vi.fn(),
}))

vi.mock('../../src/features/shared/RecordListPage', () => ({
  default: ({ renderActions }) => renderActions(reportState.report),
}))

vi.mock('../../src/features/lecturer/ReportReviewPanel', () => ({
  default: ({ reportId, onClose }) => (
    <div>
      Reviewing {reportId}
      <button onClick={onClose}>Close review</button>
    </div>
  ),
}))

import { startLecturerReport } from '../../src/api/lecturer'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  reportState.report = { id: 'report-1', assignments: [{ workStartedAt: '2026-01-15T10:00:00Z' }] }
})

describe('LecturerReports', () => {
  it('reopens work-started reports without trying to start them again', async () => {
    render(<LecturerReports />)

    fireEvent.click(screen.getByRole('button', { name: 'Review' }))

    expect(await screen.findByText('Reviewing report-1')).not.toBeNull()
    expect(startLecturerReport).not.toHaveBeenCalled()
  })

  it('starts work before opening an unstarted report', async () => {
    reportState.report = { id: 'report-2', assignments: [{ workStartedAt: null }] }
    startLecturerReport.mockResolvedValue({ success: true })
    render(<LecturerReports />)

    fireEvent.click(screen.getByRole('button', { name: 'Review' }))

    await waitFor(() => {
      expect(startLecturerReport).toHaveBeenCalledWith('report-2')
      expect(screen.getByText('Reviewing report-2')).not.toBeNull()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Close review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Review' }))

    expect(await screen.findByText('Reviewing report-2')).not.toBeNull()
    expect(startLecturerReport).toHaveBeenCalledTimes(1)
  })
})
