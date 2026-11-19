import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff } from 'lucide-react'
import '../../styles/QrCameraScanner.css'

export default function QrCameraScanner({ onDecode, disabled = false, label = 'Start camera scanner' }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const activeRef = useRef(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  const stop = () => {
    activeRef.current = false
    controlsRef.current?.stop()
    controlsRef.current = null
    setStarting(false)
  }

  useEffect(() => () => {
    activeRef.current = false
    controlsRef.current?.stop()
  }, [])

  const start = async () => {
    setError('')
    setStarting(true)
    activeRef.current = true
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not available in this browser. Use a supported browser or ask an invigilator for help.')
      }
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      if (!activeRef.current || !videoRef.current) return
      const reader = new BrowserQRCodeReader()
      controlsRef.current = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, scanError, controls) => {
          if (result && activeRef.current) {
            activeRef.current = false
            controls.stop()
            controlsRef.current = null
            setStarting(false)
            onDecode(result.getText())
          } else if (scanError && !['NotFoundException', 'ChecksumException', 'FormatException'].includes(scanError.name)) {
            setError('Unable to read the QR code. Check camera permission and lighting, then try again.')
          }
        },
      )
    } catch (cameraError) {
      activeRef.current = false
      const messages = {
        NotAllowedError: 'Camera permission was denied. Allow camera access in browser settings and try again.',
        NotFoundError: 'No camera was found on this device.',
        NotReadableError: 'The camera is already in use by another application.',
        SecurityError: 'Camera access requires a secure connection (HTTPS).',
      }
      setError(messages[cameraError.name] || cameraError.message || 'Unable to start the camera scanner.')
      setStarting(false)
    }
  }

  return (
    <div className="qr-camera-scanner">
      {error && <div className="form-alert" role="alert">{error}</div>}
      <video ref={videoRef} className="qr-camera-scanner-video" muted playsInline aria-label="Live QR scanner preview" />
      {starting
        ? <button className="button button-secondary" type="button" onClick={stop}><CameraOff size={16} /> Stop camera</button>
        : <button className="button button-secondary" type="button" onClick={start} disabled={disabled}><Camera size={16} /> {label}</button>}
    </div>
  )
}
