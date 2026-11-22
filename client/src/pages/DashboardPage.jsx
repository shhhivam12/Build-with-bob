import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import '../leaflet-setup.js'
import styles from './DashboardPage.module.css'

// Default map centre — New Delhi, India (can be changed)
const DEFAULT_CENTER = [28.6139, 77.209]
const DEFAULT_ZOOM = 12

const WS_URL = `ws://${window.location.hostname}:3001/ws`

export default function DashboardPage() {
  const [reports, setReports] = useState([])
  const [live, setLive] = useState(false)
  const wsRef = useRef(null)
  const liveTimerRef = useRef(null)

  // Fetch existing reports
  useEffect(() => {
    fetch('/api/reports')
      .then((r) => r.json())
      .then((data) => setReports(data))
      .catch(console.error)
  }, [])

  // WebSocket for live updates
  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'new_report') {
            setReports((prev) => [msg.report, ...prev])
            // Flash live indicator
            setLive(true)
            clearTimeout(liveTimerRef.current)
            liveTimerRef.current = setTimeout(() => setLive(false), 3000)
          }
        } catch {
          // ignore malformed messages
        }
      }

      ws.onclose = () => {
        // Auto-reconnect after 3s
        setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      clearTimeout(liveTimerRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null // prevent reconnect on unmount
        wsRef.current.close()
      }
    }
  }, [])

  const markableReports = reports.filter(
    (r) => r.latitude != null && r.longitude != null
  )

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Authority View — Live Reports</h1>
          <p className={styles.subtitle}>Real-time traffic violation submissions</p>
        </div>
        <div className={`${styles.liveIndicator} ${live ? styles.livePulse : ''}`}>
          <span className={styles.liveDot} />
          Live
        </div>
      </header>

      <div className={styles.layout}>
        <div className={styles.mapWrapper}>
          <MapContainer
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            className={styles.map}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {markableReports.map((report) => (
              <Marker key={report.id} position={[report.latitude, report.longitude]}>
                <Popup>
                  <div className={styles.popup}>
                    <strong>{report.violationType}</strong>
                    <br />
                    <span>{new Date(report.timestamp).toLocaleString()}</span>
                    {report.imageData && (
                      <img
                        src={report.imageData}
                        alt={report.violationType}
                        className={styles.popupImg}
                      />
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <aside className={styles.sidebar}>
          <h2 className={styles.sidebarTitle}>
            Reports <span className={styles.count}>({reports.length})</span>
          </h2>
          {reports.length === 0 && (
            <p className={styles.empty}>No reports yet. Waiting for submissions…</p>
          )}
          <ul className={styles.list}>
            {reports.map((report) => (
              <li key={report.id} className={styles.reportCard}>
                {report.imageData ? (
                  <img
                    src={report.imageData}
                    alt={report.violationType}
                    className={styles.thumb}
                  />
                ) : (
                  <div className={styles.thumbPlaceholder}>📷</div>
                )}
                <div className={styles.cardInfo}>
                  <span className={styles.badge}>{report.violationType}</span>
                  <span className={styles.cardTime}>
                    {new Date(report.timestamp).toLocaleString()}
                  </span>
                  {report.latitude ? (
                    <span className={styles.coords}>
                      {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                    </span>
                  ) : (
                    <span className={styles.noCoords}>No GPS data</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}
