import { useState } from 'react'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import { importStudentRoster } from '../../api/admin'
import {
  MAX_ROSTER_FILE_BYTES,
  parseRosterCsv,
  validateRosterRecords,
  csvEscape,
} from './roster-import-utils'
import './AdminRosterImport.css'

const ACCEPTED_TYPES = new Set(['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/octet-stream'])

function responseData(response) {
  return response?.data?.data ?? response?.data ?? response
}

function downloadCsv(filename, contents) {
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default function AdminRosterImport() {
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const loadFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    setNotice('')
    setRows([])
    setFileName('')

    const mimeType = file.type.toLowerCase().split(';')[0].trim()
    if (!file.name.toLowerCase().endsWith('.csv') || (mimeType && !ACCEPTED_TYPES.has(mimeType))) {
      setError('Choose a CSV file. Excel workbooks are not supported.')
      return
    }
    if (file.size > MAX_ROSTER_FILE_BYTES) {
      setError('The CSV file must be 1 MiB or smaller.')
      return
    }

    try {
      const previewRows = validateRosterRecords(parseRosterCsv(await file.text()))
      setRows(previewRows)
      setFileName(file.name)
      if (previewRows.some(({ status }) => status === 'INVALID')) {
        setNotice('Review the highlighted rows. Only valid records can be imported.')
      } else {
        setNotice(`${previewRows.length} records are ready for review.`)
      }
    } catch (parseError) {
      setError(parseError.message || 'Unable to read this CSV file.')
    }
  }

  const updateRecord = (sourceRow, field, value) => {
    const currentByRow = new Map(rows.map((row) => [row.sourceRow, row]))
    const updated = validateRosterRecords(rows.map((row) => ({
      sourceRow: row.sourceRow,
      studentNumber: row.sourceRow === sourceRow && field === 'studentNumber' ? value : row.studentNumber,
      fullName: row.sourceRow === sourceRow && field === 'fullName' ? value : row.fullName,
      email: row.sourceRow === sourceRow && field === 'email' ? value : row.email,
    })))
    setRows(updated.map((row) => {
      const previous = currentByRow.get(row.sourceRow)
      return {
        ...row,
        serverStatus: row.sourceRow === sourceRow ? '' : previous.serverStatus,
        serverMessage: row.sourceRow === sourceRow ? '' : previous.serverMessage,
      }
    }))
    setError('')
    setNotice('')
  }

  const removeRecord = (sourceRow) => {
    const remaining = rows.filter((row) => row.sourceRow !== sourceRow)
    const previousByRow = new Map(rows.map((row) => [row.sourceRow, row]))
    setRows(validateRosterRecords(remaining.map(({ sourceRow: rowNumber, studentNumber, fullName, email }) => ({
      sourceRow: rowNumber, studentNumber, fullName, email,
    }))).map((row) => ({
      ...row,
      serverStatus: previousByRow.get(row.sourceRow).serverStatus,
      serverMessage: previousByRow.get(row.sourceRow).serverMessage,
    })))
    setError('')
    setNotice('')
  }

  const importRows = async () => {
    const eligibleRows = rows.filter((row) => row.status === 'VALID' && !row.serverStatus)
    if (!eligibleRows.length) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const students = eligibleRows.map(({ studentNumber, fullName, email }) => ({ studentNumber, fullName, email }))
      const bodySize = new TextEncoder().encode(JSON.stringify({ students })).length
      if (bodySize > 900 * 1024) {
        setError('The prepared request is too large. Remove some records and import them in smaller batches.')
        return
      }

      const payload = responseData(await importStudentRoster({ students }))
      if (!payload || !Array.isArray(payload.results) || payload.results.length !== eligibleRows.length) {
        throw new Error('The server returned an incomplete import result. The preview has been kept unchanged.')
      }
      const seenIndexes = new Set()
      const normalizedResults = payload.results.map((result) => {
        if (!Number.isInteger(result.index) || result.index < 0 || result.index >= eligibleRows.length
          || seenIndexes.has(result.index) || !['IMPORTED', 'SKIPPED', 'FAILED'].includes(result.status)
          || typeof result.message !== 'string') {
          throw new Error('The server returned an invalid import result. The preview has been kept unchanged.')
        }
        seenIndexes.add(result.index)
        return result
      })

      const resultsBySourceRow = new Map(normalizedResults.map((result) => [
        eligibleRows[result.index].sourceRow,
        { serverStatus: result.status, serverMessage: result.message },
      ]))
      setRows((current) => current.map((row) => ({
        ...row,
        ...(resultsBySourceRow.get(row.sourceRow) ?? {}),
      })))
      const imported = normalizedResults.filter(({ status }) => status === 'IMPORTED').length
      const skipped = normalizedResults.filter(({ status }) => status === 'SKIPPED').length
      const failed = normalizedResults.filter(({ status }) => status === 'FAILED').length
      setNotice(`Import processed: ${imported} imported, ${skipped} skipped, ${failed} failed.`)
    } catch (requestError) {
      setError(requestError.userMessage || requestError.message || 'Unable to import the roster. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const downloadTemplate = () => downloadCsv('student-roster-template.csv', 'studentNumber,fullName,email\r\n')
  const reportRows = rows.filter((row) => row.status === 'INVALID' || (row.serverStatus && row.serverStatus !== 'IMPORTED'))
  const downloadErrorReport = () => {
    const header = 'source_row,outcome,error'
    const records = reportRows.map((row) => [
      row.sourceRow,
      row.serverStatus || 'INVALID',
      row.serverMessage || row.issues.join(' '),
    ].map(csvEscape).join(','))
    downloadCsv('student-roster-errors.csv', [header, ...records].join('\r\n'))
  }
  const validCount = rows.filter((row) => row.status === 'VALID' && !row.serverStatus).length
  const invalidCount = rows.filter((row) => row.status === 'INVALID').length

  return (
    <section className="admin-roster-import">
      <header className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h2>Student roster import</h2>
          <p>Preview and validate a CSV roster before adding eligible students.</p>
        </div>
      </header>

      {error && <div className="form-alert" role="alert">{error}</div>}
      {notice && <div className="form-success" role="status">{notice}</div>}

      <section className="panel roster-import-panel" aria-labelledby="roster-upload-title">
        <div className="roster-import-panel-heading">
          <div>
            <h3 id="roster-upload-title">Upload a roster</h3>
            <p>CSV only, up to 1 MiB and 1,000 student records. Required columns: <code>studentNumber</code>, <code>fullName</code>, <code>email</code>.</p>
          </div>
          <button className="button button-secondary" type="button" onClick={downloadTemplate}>
            <Download size={16} /> Download template
          </button>
        </div>
        <label className="roster-file-picker">
          <FileSpreadsheet size={20} aria-hidden="true" />
          <span>{fileName || 'Choose a CSV roster file'}</span>
          <input type="file" accept=".csv,text/csv" onChange={loadFile} disabled={busy} />
        </label>
        <p className="roster-import-privacy">Existing student information is never overwritten. Error reports and audit records do not include student names, registration numbers, email addresses, or passwords.</p>
      </section>

      {rows.length > 0 && (
        <section className="panel roster-preview-panel" aria-labelledby="roster-preview-title">
          <div className="roster-import-panel-heading">
            <div>
              <h3 id="roster-preview-title">Import preview</h3>
              <p>{rows.length} records from {fileName}. Correct fields or remove rows before importing.</p>
            </div>
            <div className="roster-preview-actions">
              {reportRows.length > 0 && (
                <button className="button button-secondary" type="button" onClick={downloadErrorReport}>
                  <Download size={16} /> Download error report
                </button>
              )}
              <button className="button button-primary" type="button" onClick={importRows} disabled={!validCount || busy}>
                <Upload size={16} /> {busy ? 'Importing…' : `Import ${validCount} valid record${validCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>

          <div className="roster-counts" aria-label="Roster validation summary">
            <span>{validCount} ready</span>
            <span>{invalidCount} invalid</span>
            <span>{rows.filter((row) => row.serverStatus === 'IMPORTED').length} imported</span>
            <span>{rows.filter((row) => row.serverStatus === 'SKIPPED').length} skipped</span>
            <span>{rows.filter((row) => row.serverStatus === 'FAILED').length} failed</span>
          </div>

          <div className="table-wrap roster-preview-table-wrap">
            <table className="roster-preview-table">
              <thead>
                <tr>
                  <th scope="col">CSV row</th>
                  <th scope="col">Student number</th>
                  <th scope="col">Full name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Status and issues</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const status = row.serverStatus || row.status
                  const message = row.serverMessage || row.issues.join(' ')
                  return (
                    <tr key={row.sourceRow} className={`roster-row-${status.toLowerCase()}`}>
                      <td>{row.sourceRow}</td>
                      <td><input aria-label={`Student number on row ${row.sourceRow}`} value={row.studentNumber} onChange={(event) => updateRecord(row.sourceRow, 'studentNumber', event.target.value)} disabled={busy} /></td>
                      <td><input aria-label={`Full name on row ${row.sourceRow}`} value={row.fullName} onChange={(event) => updateRecord(row.sourceRow, 'fullName', event.target.value)} disabled={busy} /></td>
                      <td><input aria-label={`Email on row ${row.sourceRow}`} type="email" value={row.email} onChange={(event) => updateRecord(row.sourceRow, 'email', event.target.value)} disabled={busy} /></td>
                      <td><strong>{status}</strong>{message && <span className="roster-row-message">{message}</span>}</td>
                      <td><button className="button button-secondary roster-remove-button" type="button" onClick={() => removeRecord(row.sourceRow)} disabled={busy} aria-label={`Remove row ${row.sourceRow}`}>Remove</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </section>
  )
}
