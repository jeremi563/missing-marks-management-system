import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, RefreshCw } from 'lucide-react'
import QrCameraScanner from '../../components/ui/QrCameraScanner'
import { getStudentExamAttendance, getStudentExamBooklets, scanStudentExamBooklet } from '../../api/student'
import { useExamBookletVerificationWindow } from '../shared/examBookletVerificationWindow'

function records(response) {
  const payload = response?.data ?? response
  return Array.isArray(payload) ? payload : payload?.items ?? []
}

export default function StudentExamBookletVerification() {
  const [booklets, setBooklets] = useState([])
  const [attendance, setAttendance] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setError('')
    const [bookletResponse, attendanceResponse] = await Promise.all([
      getStudentExamBooklets(),
      getStudentExamAttendance({ page: 1, limit: 100 }),
    ])
    const nextBooklets = records(bookletResponse)
    setBooklets(nextBooklets)
    setAttendance(records(attendanceResponse))
    setSelectedId((current) => current && nextBooklets.some((item) => item.id === current)
      ? current
      : nextBooklets.find((item) => item.status === 'ALLOCATED')?.id || '')
  }, [])

  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(() => active && load())
      .catch((requestError) => { if (active) setError(requestError.userMessage || 'Unable to load examination booklet allocations.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [load])

  const selected = booklets.find(({ id }) => id === selectedId)
  const canVerifyBooklet = useExamBookletVerificationWindow(selected?.session)
  const scan = async (qrPayload) => {
    setError('')
    setNotice('')
    if (!selected) {
      setError('Select your allocated booklet before scanning its QR code.')
      return
    }
    if (!canVerifyBooklet) {
      setError('The booklet verification window is closed for this examination session.')
      return
    }
    if (!/^[a-f0-9]{64}$/i.test(qrPayload)) {
      setError('This is not a valid examination booklet QR code.')
      return
    }
    setScanning(true)
    try {
      const response = await scanStudentExamBooklet({ sessionId: selected.session.id, token: qrPayload })
      const result = response?.data ?? response
      setNotice(result.duplicate
        ? 'This booklet was already verified. Your examination attendance is verified.'
        : 'Booklet verified. Your examination attendance is now verified.')
      await load()
    } catch (requestError) {
      setError(requestError.userMessage || requestError.response?.data?.message || 'Unable to verify this examination booklet.')
    } finally {
      setScanning(false)
    }
  }

  return (
    <section>
      <header className="page-heading">
        <div>
          <p className="eyebrow">STUDENT PORTAL</p>
          <h2>Examination booklet verification</h2>
          <p>Scan the QR code on your allocated booklet during the active examination session. Verification also updates your examination attendance.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => load()} disabled={loading}>
          <RefreshCw size={16} /> Refresh status
        </button>
      </header>

      {error && <div className="form-alert" role="alert">{error}</div>}
      {notice && <div className="form-success" role="status"><CheckCircle size={18} /> {notice}</div>}
      {loading
        ? <p role="status">Loading your examination booklet allocations…</p>
        : booklets.length === 0
          ? <section className="panel"><h3>No booklet allocation yet</h3><p>Ask your examination invigilator to allocate your booklet for the active examination.</p></section>
          : (
            <section className="panel">
              <label>Allocated booklet
                <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                  <option value="" disabled>Select an allocated booklet</option>
                  {booklets.map((booklet) => (
                    <option key={booklet.id} value={booklet.id}>
                      {booklet.assessment?.code || booklet.assessment?.name} · {booklet.session?.courseUnit?.code} · {booklet.status.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
              {selected && (
                <div className="exam-booklet-allocation">
                  <p><strong>Booklet:</strong> {selected.bookletIdentifier}</p>
                  <p><strong>Assessment:</strong> {selected.assessment?.name || selected.assessment?.code}</p>
                  <p><strong>Course unit:</strong> {selected.session?.courseUnit?.code} · {selected.session?.courseUnit?.name}</p>
                  <p><strong>Booklet status:</strong> {selected.status.replaceAll('_', ' ')}</p>
                  <p><strong>Attendance status:</strong> {attendance.find((item) => item.session?.id === selected.session?.id)?.examVerificationStatus?.replaceAll('_', ' ') || 'Not yet verified'}</p>
                  {selected.status === 'ALLOCATED' && canVerifyBooklet && !scanning && <QrCameraScanner onDecode={scan} label="Scan my booklet QR" />}
                  {selected.status === 'ALLOCATED' && !canVerifyBooklet && <p role="status">Booklet verification is closed for this examination session.</p>}
                  {scanning && <p role="status">Verifying booklet and refreshing attendance…</p>}
                </div>
              )}
            </section>
          )}
    </section>
  )
}
