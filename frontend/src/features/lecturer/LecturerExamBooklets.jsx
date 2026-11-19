import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, RefreshCw, ShieldAlert } from 'lucide-react'
import QrCameraScanner from '../../components/ui/QrCameraScanner'
import {
  allocateLecturerExamBooklets,
  getLecturerAttendanceSessions,
  getLecturerExamBookletScans,
  manualLookupLecturerExamBooklet,
  previewLecturerExamBooklet,
  replaceLecturerExamBooklet,
  scanLecturerExamBooklet,
} from '../../api/lecturer'
import { extractRecords } from '../shared/recordUtils'
import { useExamBookletVerificationWindow } from '../shared/examBookletVerificationWindow'

function unwrap(response) {
  const first = response?.data ?? response
  return first?.data ?? first
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : 'Not available'
}

export default function LecturerExamBooklets() {
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState('')
  const [allocations, setAllocations] = useState([])
  const [history, setHistory] = useState([])
  const [qrImages, setQrImages] = useState({})
  const [preview, setPreview] = useState(null)
  const [manualStudentNumber, setManualStudentNumber] = useState('')
  const [manualConfirmed, setManualConfirmed] = useState(false)
  const [replacementBookletId, setReplacementBookletId] = useState('')
  const [replacementReason, setReplacementReason] = useState('')
  const [replacement, setReplacement] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const selectedSession = sessions.find(({ id }) => id === sessionId)
  const canVerifyBooklet = useExamBookletVerificationWindow(selectedSession)

  const loadSessions = useCallback(async () => {
    const response = await getLecturerAttendanceSessions()
    const exams = extractRecords(response, ['sessions']).filter((item) => item.sessionType === 'EXAM')
    setSessions(exams)
    setSessionId((current) => current && exams.some(({ id }) => id === current) ? current : exams[0]?.id || '')
  }, [])

  const loadHistory = useCallback(async (targetSessionId = sessionId) => {
    if (!targetSessionId) {
      setHistory([])
      return
    }
    const response = await getLecturerExamBookletScans(targetSessionId, { page: 1, limit: 50 })
    const result = unwrap(response)
    setHistory(Array.isArray(result) ? result : result?.items ?? [])
  }, [sessionId])

  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(() => active && loadSessions())
      .catch((requestError) => { if (active) setError(requestError.userMessage || 'Unable to load examination sessions.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [loadSessions])

  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(() => active && loadHistory())
      .catch((requestError) => { if (active) setError(requestError.userMessage || 'Unable to load booklet scan history.') })
    return () => { active = false }
  }, [loadHistory])

  const renderTokens = async (rows) => {
    const QRCode = (await import('qrcode')).default
    const images = {}
    await Promise.all(rows.filter(({ qrToken }) => qrToken).map(async (item) => {
      images[item.id] = await QRCode.toDataURL(item.qrToken, { width: 220, margin: 2 })
    }))
    setQrImages(images)
  }

  const loadAllocations = async ({ quiet = false } = {}) => {
    if (!sessionId) return
    setBusy(true)
    setError('')
    if (!quiet) setNotice('')
    try {
      const response = await allocateLecturerExamBooklets(sessionId)
      const result = unwrap(response)
      const rows = result?.allocations ?? []
      setAllocations(rows)
      setReplacementBookletId((current) => current && rows.some((row) => row.id === current && row.status === 'ALLOCATED')
        ? current
        : rows.find((row) => row.status === 'ALLOCATED')?.id || '')
      try {
        await renderTokens(rows)
      } catch {
        setError('Allocations were saved, but QR rendering failed. Existing QR tokens cannot be retrieved; approve a replacement to issue a fresh code.')
      }
      if (!quiet) setNotice(`${result?.newlyAllocatedCount ?? 0} new booklet allocation(s) created. Existing booklet QR codes are not reissued.`)
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to allocate examination booklets.')
    } finally {
      setBusy(false)
    }
  }

  const previewToken = async (token) => {
    setError('')
    setNotice('')
    if (!canVerifyBooklet) {
      setError('The booklet verification window is closed for this examination session.')
      return
    }
    if (!sessionId || !/^[a-f0-9]{64}$/i.test(token)) {
      setError('The QR code is invalid or no examination session is selected.')
      return
    }
    setBusy(true)
    try {
      const response = await previewLecturerExamBooklet(sessionId, token)
      setPreview({ token, allocation: unwrap(response) })
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to validate this examination booklet QR.')
    } finally {
      setBusy(false)
    }
  }

  const confirmScan = async () => {
    if (!preview || !sessionId) return
    if (!canVerifyBooklet) {
      setPreview(null)
      setError('The booklet verification window is closed for this examination session.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const response = await scanLecturerExamBooklet(sessionId, { token: preview.token, identityConfirmed: true })
      const result = unwrap(response)
      setPreview(null)
      setNotice(result.duplicate ? 'This booklet was already verified.' : 'Booklet verified and examination attendance updated.')
      await Promise.all([loadHistory(sessionId), loadAllocations({ quiet: true })])
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to verify this examination booklet.')
    } finally {
      setBusy(false)
    }
  }

  const manualLookup = async (event) => {
    event.preventDefault()
    if (!canVerifyBooklet) {
      setError('The booklet verification window is closed for this examination session.')
      return
    }
    if (!sessionId || !manualConfirmed) {
      setError("Select an examination session and confirm that the student's physical identity matches the displayed allocation.")
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await manualLookupLecturerExamBooklet(sessionId, {
        studentNumber: manualStudentNumber.trim(),
        identityConfirmed: true,
      })
      setNotice(unwrap(response).duplicate ? 'This booklet was already verified.' : 'Booklet verified by confirmed manual lookup.')
      setManualStudentNumber('')
      setManualConfirmed(false)
      await Promise.all([loadHistory(sessionId), loadAllocations({ quiet: true })])
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to find or verify this examination allocation.')
    } finally {
      setBusy(false)
    }
  }

  const approveReplacement = async (event) => {
    event.preventDefault()
    if (!replacementBookletId || !replacementReason.trim()) {
      setError('Select an active booklet and enter the replacement reason.')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await replaceLecturerExamBooklet(replacementBookletId, replacementReason.trim())
      setReplacement(unwrap(response))
      setReplacementReason('')
      setNotice('Replacement approved. The previous QR has been invalidated.')
      await Promise.all([loadHistory(sessionId), loadAllocations()])
    } catch (requestError) {
      setError(requestError.userMessage || 'Unable to approve the booklet replacement.')
    } finally {
      setBusy(false)
    }
  }

  const onSessionChange = (nextSessionId) => {
    setSessionId(nextSessionId)
    setAllocations([])
    setHistory([])
    setPreview(null)
    setReplacement(null)
  }

  return (
    <section>
      <header className="page-heading">
        <div>
          <p className="eyebrow">LECTURER PORTAL</p>
          <h2>Examination booklet verification</h2>
          <p>Allocate booklets, verify a student's identity before scanning, and review scan exceptions.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => loadHistory()} disabled={!sessionId || busy}>
          <RefreshCw size={16} /> Refresh history
        </button>
      </header>

      {error && <div className="form-alert" role="alert">{error}</div>}
      {notice && <div className="form-success" role="status"><CheckCircle size={18} /> {notice}</div>}
      {loading
        ? <p role="status">Loading examination sessions…</p>
        : (
          <>
            <section className="panel">
              <label>Examination session
                <select value={sessionId} onChange={(event) => onSessionChange(event.target.value)}>
                  <option value="">Select an exam session</option>
                  {sessions.map((session) => <option key={session.id} value={session.id}>{session.courseUnit?.code} · {session.assessment?.name || 'Exam'} · {formatDate(session.startsAt)}</option>)}
                </select>
              </label>
              <div className="form-actions">
                <button className="button button-primary" type="button" onClick={loadAllocations} disabled={!sessionId || busy}>
                  {busy ? 'Working…' : 'Allocate / load booklets'}
                </button>
              </div>
            </section>

            {sessionId && (
              <>
                <section className="panel">
                  <h3>Invigilator QR scan</h3>
                  <p>Scan the QR code, compare the displayed student details to the student's physical identity, then confirm to verify attendance.</p>
                  {canVerifyBooklet
                    ? <QrCameraScanner onDecode={previewToken} disabled={busy || Boolean(preview)} label="Start booklet QR scanner" />
                    : <p role="status">Booklet verification is closed for this examination session.</p>}
                  {preview && canVerifyBooklet && (
                    <div className="exam-booklet-confirmation" role="group" aria-label="Confirm student identity">
                      <h4>Confirm student identity</h4>
                      <p><strong>Student:</strong> {preview.allocation.student?.user?.displayName || 'Student'}</p>
                      <p><strong>Registration number:</strong> {preview.allocation.student?.studentNumber}</p>
                      <p><strong>Booklet:</strong> {preview.allocation.bookletIdentifier}</p>
                      <p><strong>Assessment:</strong> {preview.allocation.assessment?.name}</p>
                      <button className="button button-primary" type="button" onClick={confirmScan} disabled={busy}>Identity confirmed — verify booklet</button>
                      <button className="button button-secondary" type="button" onClick={() => setPreview(null)} disabled={busy}>Cancel</button>
                    </div>
                  )}
                </section>

                <section className="panel">
                  <h3>Damaged or unreadable QR</h3>
                  <p>Use manual lookup only after checking the student's physical identity against the examination allocation.</p>
                  <form className="form-grid" onSubmit={manualLookup}>
                    <label>Student registration number
                      <input value={manualStudentNumber} onChange={(event) => setManualStudentNumber(event.target.value)} required maxLength={80} disabled={!canVerifyBooklet || busy} />
                    </label>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={manualConfirmed} onChange={(event) => setManualConfirmed(event.target.checked)} disabled={!canVerifyBooklet || busy} />
                      I confirmed the student's physical identity.
                    </label>
                    <button className="button button-secondary" type="submit" disabled={busy || !canVerifyBooklet || !manualConfirmed}>Find and verify allocation</button>
                  </form>
                </section>

                {allocations.some(({ status }) => ['ALLOCATED', 'VERIFIED'].includes(status)) && (
                  <section className="panel">
                    <h3>Approve booklet replacement</h3>
                    <form className="form-grid" onSubmit={approveReplacement}>
                      <label>Active booklet
                        <select value={replacementBookletId} onChange={(event) => setReplacementBookletId(event.target.value)}>
                          {allocations.filter(({ status }) => ['ALLOCATED', 'VERIFIED'].includes(status)).map((item) => (
                            <option key={item.id} value={item.id}>{item.student?.studentNumber} · {item.bookletIdentifier}</option>
                          ))}
                        </select>
                      </label>
                      <label>Reason
                        <textarea value={replacementReason} onChange={(event) => setReplacementReason(event.target.value)} maxLength={2000} required />
                      </label>
                      <button className="button button-secondary" type="submit" disabled={busy}>Approve replacement</button>
                    </form>
                  </section>
                )}

                {replacement && (
                  <section className="panel" role="status">
                    <h3>Replacement issued</h3>
                    <p>New booklet: {replacement.bookletIdentifier}. The old QR token is no longer accepted.</p>
                    <p className="eyebrow">Print this QR now; the raw token is not stored for later retrieval.</p>
                    <QrImage token={replacement.qrToken} />
                  </section>
                )}

                {allocations.some(({ qrToken }) => qrToken) && (
                  <section className="panel">
                    <h3>New booklet QR codes</h3>
                    <p>Print these codes for the corresponding physical booklets. QR data contains only a random token.</p>
                    <div className="exam-booklet-qr-grid">
                      {allocations.filter(({ qrToken }) => qrToken).map((item) => (
                        <article key={item.id} className="exam-booklet-qr-card">
                          <p><strong>{item.student?.user?.displayName || 'Student'}</strong></p>
                          <p>{item.student?.studentNumber}</p>
                          <p>Booklet {item.bookletIdentifier}</p>
                          {qrImages[item.id] && <img src={qrImages[item.id]} alt={`QR code for booklet ${item.bookletIdentifier}`} />}
                        </article>
                      ))}
                    </div>
                  </section>
                )}

                <section className="panel">
                  <h3>Booklet scan history and exceptions</h3>
                  {history.length === 0
                    ? <p>No scans or exceptions have been recorded for this session.</p>
                    : (
                      <div className="table-wrap">
                        <table>
                          <thead><tr><th>Time</th><th>Student</th><th>Booklet</th><th>Method</th><th>Outcome</th><th>Exception</th></tr></thead>
                          <tbody>
                            {history.map((item) => (
                              <tr key={item.id}>
                                <td>{formatDate(item.occurredAt)}</td>
                                <td>{item.student?.student?.user?.displayName || item.student?.user?.displayName || 'Not identified'}<small>{item.student?.studentNumber || ''}</small></td>
                                <td>{item.booklet?.bookletIdentifier || '—'}</td>
                                <td>{item.scanMethod?.replaceAll('_', ' ')}</td>
                                <td>{item.outcome}</td>
                                <td>{item.exceptionCode ? <span><ShieldAlert size={14} /> {item.exceptionCode.replaceAll('_', ' ')}</span> : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                </section>
              </>
            )}
          </>
        )}
    </section>
  )
}

function QrImage({ token }) {
  const [image, setImage] = useState('')
  useEffect(() => {
    let active = true
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(token, { width: 220, margin: 2 }))
      .then((value) => { if (active) setImage(value) })
      .catch(() => { if (active) setImage('') })
    return () => { active = false }
  }, [token])
  return image ? <img src={image} alt="QR code for replacement examination booklet" /> : <p>Unable to render this QR code.</p>
}
