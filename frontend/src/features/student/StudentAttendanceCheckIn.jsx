import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle, MapPin, QrCode } from 'lucide-react'
import { checkInStudentAttendance } from '../../api/student'
import '../../styles/StudentAttendanceCheckIn.css'

const LOCATION_SAMPLE_WINDOW_MS = 6000
const TARGET_LOCATION_ACCURACY_METERS = 20

function getBestLocation(geolocation) {
  return new Promise((resolve, reject) => {
    let bestPosition
    let watchId
    let settled = false
    const finish = (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (watchId !== undefined) geolocation.clearWatch(watchId)
      if (bestPosition) resolve(bestPosition)
      else reject(error)
    }
    const timer = setTimeout(() => finish({ code: 2 }), LOCATION_SAMPLE_WINDOW_MS)

    try {
      watchId = geolocation.watchPosition(
        (position) => {
          if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
            bestPosition = position
          }
          if (bestPosition.coords.accuracy <= TARGET_LOCATION_ACCURACY_METERS) finish()
        },
        (error) => {
          if (bestPosition || error.code === 1) finish(error)
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      )
      if (settled) geolocation.clearWatch(watchId)
    } catch (error) {
      finish(error)
    }
  })
}

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
    getBestLocation(navigator.geolocation)
      .then(async ({ coords }) => {
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
        }
      })
      .catch((locationError) => {
        const messages = {
          1: 'Location permission was denied. Allow location access in your browser settings and try again.',
          2: 'Your location could not be determined. Move near a window or enable device location and retry.',
          3: 'Location lookup timed out. Please try again.',
        }
        setError(messages[locationError?.code] || 'Unable to access your device location.')
      })
      .finally(() => {
        setCheckingIn(false)
      })
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
            {result.session?.sessionType === 'CAT' && result.catSubmission?.status === 'PENDING_REVIEW' && (
              <p role="status">Your CAT submission is awaiting lecturer verification.</p>
            )}
            {result.session?.sessionType === 'EXAM' && result.record?.examVerificationStatus === 'PENDING_REVIEW' && (
              <p role="status">Your examination attendance is awaiting lecturer verification.</p>
            )}
            {result.session?.sessionType === 'CAT' && result.catSubmission?.status === 'REJECTED' && (
              <p role="status">A CAT submission already exists with status Rejected. Review its decision reason in attendance history.</p>
            )}
          </div>
        </div>
      )}

      {!result && (
        <div className="student-attendance-checkin-actions">
          <p><MapPin size={16} /> We collect a few fresh GPS readings and use the most precise one. The server checks the reported location against the classroom boundary set by your administrator; your coordinates are not saved as part of your attendance record.</p>
          <button className="button button-primary" type="button" onClick={submitCheckIn} disabled={checkingIn || !token}>
            <MapPin size={16} />{checkingIn ? 'Checking your location…' : 'Verify location and check in'}
          </button>
          {!token && <small>Scan a current attendance QR code or open the link sent by your lecturer.</small>}
        </div>
      )}
    </section>
  )
}
