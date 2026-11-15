import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminRosterImport from '../../src/features/admin/AdminRosterImport'
import { importStudentRoster } from '../../src/api/admin'

vi.mock('../../src/api/admin', () => ({
  importStudentRoster: vi.fn(),
}))

afterEach(cleanup)
beforeEach(() => vi.clearAllMocks())

function rosterFile(content) {
  const file = new File([content], 'roster.csv', { type: 'text/csv' })
  Object.defineProperty(file, 'text', { value: async () => content })
  return file
}

describe('AdminRosterImport', () => {
  it('previews duplicates, allows correction, imports records, and displays row outcomes', async () => {
    const year = String(new Date().getFullYear() % 100).padStart(2, '0')
    const csv = [
      'studentNumber,fullName,email',
      `IN16/00111/${year},Taylor Student,student@example.test`,
      `in16/00111/${year},Duplicate Student,duplicate@example.test`,
      `IN16/00112/${year},Missing Email,`,
    ].join('\r\n')
    importStudentRoster.mockResolvedValue({
      data: {
        success: true,
        data: {
          imported: 1,
          skipped: 1,
          failed: 0,
          results: [
            { index: 0, status: 'IMPORTED', message: 'Student added to the roster.' },
            { index: 1, status: 'SKIPPED', message: 'Already on roster; no changes made.' },
          ],
        },
      },
    })

    const { container } = render(<AdminRosterImport />)
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [rosterFile(csv)] } })

    expect(await screen.findByText('3 records from roster.csv. Correct fields or remove rows before importing.')).toBeTruthy()
    expect(screen.getAllByText('INVALID').length).toBe(3)
    fireEvent.click(screen.getByRole('button', { name: 'Remove row 3' }))
    const importButton = screen.getByRole('button', { name: 'Import 1 valid record' })
    expect(importButton.disabled).toBe(false)

    fireEvent.change(screen.getByLabelText('Email on row 4'), { target: { value: 'new@example.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Import 2 valid records' }))

    await waitFor(() => expect(importStudentRoster).toHaveBeenCalledWith({
      students: [
        { studentNumber: `IN16/00111/${year}`, fullName: 'Taylor Student', email: 'student@example.test' },
        { studentNumber: `IN16/00112/${year}`, fullName: 'Missing Email', email: 'new@example.test' },
      ],
    }))
    expect(await screen.findByText('Import processed: 1 imported, 1 skipped, 0 failed.')).toBeTruthy()
    expect(screen.getByText('IMPORTED')).toBeTruthy()
    expect(screen.getByText('SKIPPED')).toBeTruthy()
  })

  it('rejects non-CSV files with an explicit format message', async () => {
    const { container } = render(<AdminRosterImport />)
    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [new File(['workbook'], 'roster.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })] },
    })
    expect((await screen.findByRole('alert')).textContent).toContain('Choose a CSV file. Excel workbooks are not supported.')
    expect(importStudentRoster).not.toHaveBeenCalled()
  })
})
