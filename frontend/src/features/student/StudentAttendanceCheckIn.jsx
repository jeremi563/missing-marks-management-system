import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle, MapPin, QrCode } from 'lucide-react'
import { checkInStudentAttendance } from '../../api/student'
import '../../styles/StudentAttendanceCheckIn.css'

export default function StudentAttendanceCheckIn() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [checkingIn, setCheckingIn] = useState(false)

  const submitCheckIn = async () => {
    setError('')
    setResult(null)
    if (!token) {
      setError('This attendance link is missing its check-in code. Ask your lecturer for a new link.')
      return
    }
    if (!navigator.geolocation) {
      setError('Location access is not available in this browser. Open the link on a device with GPS enabled.')
      return
    }

    setCheckingIn(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const response = await checkInStudentAttendance({
            token,
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracyMeters: coords.accuracy,
          })
          setResult(response?.data ?? response)
          navigate('/student/attendance/check-in', { replace: true })
        } catch (requestError) {
          setError(requestError.userMessage || requestError.response?.data?.message || 'Unable to verify your location and record attendance.')
        } finally {
          setCheckingIn(false)
        }
      },
      (locationError) => {
        const messages = {
          1: 'Location permission was denied. Allow location access in your browser settings and try again.',
          2: 'Your location could not be determined. Move near a window or enable device location and retry.',
          3: 'Location lookup timed out. Please try again.',
        }
        setError(messages[locationError.code] || 'Unable to access your device location.')
        setCheckingIn(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  return (
    <section className="student-attendance-checkin">
      <header>
        <span className="student-attendance-checkin-icon"><QrCode size={22} /></span>
        <p className="eyebrow">STUDENT PORTAL</p>
        <h1>Attendance check-in</h1>
        <p>Allow location access so the system can verify that you are within the configured classroom boundary.</p>
      </header>

      {error && <div className="form-alert" role="alert">{error}</div>}
      {result && (
        <div className="student-attendance-checkin-success" role="status">
          <CheckCircle size={22} />
          <div>
            <strong>Attendance recorded</strong>
            <p>{result.session?.courseUnit?.code} — {result.session?.courseUnit?.name}</p>
            {result.session?.classroomName && <small>{result.session.classroomName}</small>}
          </div>
        </div>
      )}

      {!result && (
        <div className="student-attendance-checkin-actions">
          <p><MapPin size={16} /> Your coordinates are checked by the server and are not saved as part of your attendance record.</p>
          <button className="button button-primary" type="button" onClick={submitCheckIn} disabled={checkingIn || !token}>
            <MapPin size={16} />{checkingIn ? 'Checking your location…' : 'Verify location and check in'}
          </button>
          {!token && <small>Scan a current attendance QR code or open the link sent by your lecturer.</small>}
        </div>
      )}
    </section>
  )
}
