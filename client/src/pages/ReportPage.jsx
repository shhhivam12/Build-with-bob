import { useState, useRef, useEffect } from 'react'
import styles from './ReportPage.module.css'

const VIOLATION_TYPES = [
  'Red Light Jumping',
  'Wrong-Way Driving',
  'No Helmet',
  'Speeding',
  'Illegal Parking',
  'Using Phone While Driving',
  'Drunk Driving',
  'Overloading',
]

export default function ReportPage() {
  const [violationType, setViolationType] = useState(VIOLATION_TYPES[0])
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [geoError, setGeoError] = useState('')
  const [timestamp, setTimestamp] = useState('')
  const [imageBlob, setImageBlob] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [status, setStatus] = useState(null) // 'success' | 'error' | null
  const [submitting, setSubmitting] = useState(false)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  // Auto-fill timestamp on mount
  useEffect(() => {
    const now = new Date()
    setTimestamp(formatDateTimeLocal(now))
  }, [])

  // Auto-fill geolocation on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported by this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6))
        setLongitude(pos.coords.longitude.toFixed(6))
      },
      () => {
        setGeoError('Location permission denied. Coordinates will not be recorded.')
      }
    )
  }, [])

  function formatDateTimeLocal(date) {
    const pad = (n) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      setCameraActive(true)
      // Set video src after state update causes re-render
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      }, 0)
    } catch {
      alert('Could not access camera. Please use file upload instead.')
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }

  function captureFrame() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      setImageBlob(blob)
      setPreviewUrl(URL.createObjectURL(blob))
      stopCamera()
    }, 'image/jpeg', 0.85)
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageBlob(file)
    setPreviewUrl(URL.createObjectURL(file))
    stopCamera()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!imageBlob) {
      alert('Please capture or upload a photo first.')
      return
    }
    setSubmitting(true)
    setStatus(null)
    const formData = new FormData()
    formData.append('violationType', violationType)
    formData.append('latitude', latitude)
    formData.append('longitude', longitude)
    formData.append('timestamp', new Date(timestamp).toISOString())
    formData.append('image', imageBlob, 'photo.jpg')
    try {
      const res = await fetch('/api/reports', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Server error')
      setStatus('success')
      // Reset form
      setImageBlob(null)
      setPreviewUrl(null)
      setViolationType(VIOLATION_TYPES[0])
      const now = new Date()
      setTimestamp(formatDateTimeLocal(now))
    } catch {
      setStatus('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Report a Traffic Violation</h1>
      <p className={styles.subtitle}>Anonymous — no personal data is collected</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        {/* Photo section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Photo Evidence</h2>
          <div className={styles.photoActions}>
            {!cameraActive && (
              <button type="button" className={styles.btnSecondary} onClick={startCamera}>
                📷 Open Camera
              </button>
            )}
            <label className={styles.btnSecondary}>
              📁 Upload Photo
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </label>
          </div>

          {cameraActive && (
            <div className={styles.cameraContainer}>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} autoPlay playsInline className={styles.video} />
              <div className={styles.cameraControls}>
                <button type="button" className={styles.btnPrimary} onClick={captureFrame}>
                  📸 Capture
                </button>
                <button type="button" className={styles.btnSecondary} onClick={stopCamera}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {previewUrl && (
            <div className={styles.previewContainer}>
              <img src={previewUrl} alt="Preview" className={styles.preview} />
              <button
                type="button"
                className={styles.btnDanger}
                onClick={() => { setPreviewUrl(null); setImageBlob(null) }}
              >
                Remove Photo
              </button>
            </div>
          )}

          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </section>

        {/* Violation type */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Violation Type</h2>
          <select
            className={styles.select}
            value={violationType}
            onChange={(e) => setViolationType(e.target.value)}
            required
          >
            {VIOLATION_TYPES.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </section>

        {/* Location */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Location</h2>
          {geoError && <p className={styles.warning}>{geoError}</p>}
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Latitude</label>
              <input
                className={styles.input}
                type="text"
                value={latitude}
                readOnly
                placeholder="Waiting for GPS…"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Longitude</label>
              <input
                className={styles.input}
                type="text"
                value={longitude}
                readOnly
                placeholder="Waiting for GPS…"
              />
            </div>
          </div>
        </section>

        {/* Date / Time */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Date &amp; Time</h2>
          <input
            className={styles.input}
            type="datetime-local"
            value={timestamp}
            readOnly
          />
        </section>

        {/* Submit */}
        {status === 'success' && (
          <div className={styles.success}>
            ✅ Report submitted successfully! Thank you for helping keep roads safe.
          </div>
        )}
        {status === 'error' && (
          <div className={styles.error}>
            ❌ Submission failed. Please try again.
          </div>
        )}

        <button
          type="submit"
          className={styles.btnSubmit}
          disabled={submitting}
        >
          {submitting ? 'Submitting…' : 'Submit Report'}
        </button>
      </form>
    </div>
  )
}
