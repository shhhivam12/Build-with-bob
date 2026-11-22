import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import '../leaflet-setup.js'
import styles from './DashboardPage.module.css'
import { apiUrl, wsUrl } from '../api.js'

const DEFAULT_CENTER = [28.6139, 77.209]
const DEFAULT_ZOOM = 12
const WS_URL = wsUrl()

const VIOLATION_TYPES = [
  'All Types',
  'Red Light Jumping',
  'Wrong-Way Driving',
  'No Helmet',
  'Speeding',
  'Illegal Parking',
  'Using Phone While Driving',
  'Drunk Driving',
  'Overloading',
]

// Badge colour per violation type
const BADGE_COLORS = {
  'Red Light Jumping':        '#dc2626',
  'Wrong-Way Driving':        '#ea580c',
  'No Helmet':                '#d97706',
  'Speeding':                 '#ca8a04',
  'Illegal Parking':          '#65a30d',
  'Using Phone While Driving':'#0891b2',
  'Drunk Driving':            '#7c3aed',
  'Overloading':              '#be185d',
}

/** Flyto the latest report with GPS whenever it changes */
function MapFlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (target) {
      map.flyTo([target.latitude, target.longitude], 15, { duration: 1.2 })
    }
  }, [target, map])
  return null
}

function exportCSV(reports) {
  const cols = ['id', 'violationType', 'description', 'latitude', 'longitude', 'timestamp']
  const header = cols.join(',')
  const rows = reports.map((r) =>
    cols.map((c) => {
      const v = r[c] ?? ''
      const s = String(v).replace(/"/g, '""')
      return /[,"\n]/.test(s) ? `"${s}"` : s
    }).join(',')
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `violation-reports-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function DashboardPage() {
  const [reports, setReports] = useState([])
  const [live, setLive] = useState(false)
  const [filterType, setFilterType] = useState('All Types')
  const [search, setSearch] = useState('')
  const [flyTarget, setFlyTarget] = useState(null)
  const wsRef = useRef(null)
  const liveTimerRef = useRef(null)

  // Fetch existing reports
  useEffect(() => {
    fetch(apiUrl('/api/reports'))
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
            setLive(true)
            clearTimeout(liveTimerRef.current)
            liveTimerRef.current = setTimeout(() => setLive(false), 3000)
            if (msg.report.latitude != null) {
              setFlyTarget(msg.report)
            }
          } else if (msg.type === 'delete_report') {
            setReports((prev) => prev.filter((r) => r.id !== msg.id))
          }
        } catch {
          // ignore malformed messages
        }
      }

      ws.onclose = () => { setTimeout(connect, 3000) }
      ws.onerror = () => { ws.close() }
    }

    connect()

    return () => {
      clearTimeout(liveTimerRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
      }
    }
  }, [])

  const handleDelete = useCallback(async (id) => {
    if (!confirm('Delete this report? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/reports/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setReports((prev) => prev.filter((r) => r.id !== id))
    } catch {
      alert('Failed to delete report.')
    }
  }, [])

  // Filtered + searched list
  const filtered = reports.filter((r) => {
    const typeMatch = filterType === 'All Types' || r.violationType === filterType
    const q = search.toLowerCase()
    const textMatch = !q || (
      r.violationType.toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q)
    )
    return typeMatch && textMatch
  })

  const markableReports = filtered.filter((r) => r.latitude != null && r.longitude != null)

  // Stats: counts per violation type across ALL reports (unfiltered)
  const typeCounts = reports.reduce((acc, r) => {
    acc[r.violationType] = (acc[r.violationType] || 0) + 1
    return acc
  }, {})
  const topTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Authority View — Live Reports</h1>
          <p className={styles.subtitle}>Real-time traffic violation submissions</p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.csvBtn}
            onClick={() => exportCSV(filtered)}
            title="Export filtered reports to CSV"
          >
            ⬇ Export CSV
          </button>
          <div className={`${styles.liveIndicator} ${live ? styles.livePulse : ''}`}>
            <span className={styles.liveDot} />
            Live
          </div>
        </div>
      </header>

      {/* Stats bar */}
      <div className={styles.statsBar}>
        <div className={styles.statTotal}>
          <span className={styles.statNum}>{reports.length}</span>
          <span className={styles.statLabel}>Total Reports</span>
        </div>
        <div className={styles.statDivider} />
        {topTypes.map(([type, count]) => (
          <div key={type} className={styles.statItem}>
            <span
              className={styles.statDot}
              style={{ background: BADGE_COLORS[type] || '#3b82d4' }}
            />
            <span className={styles.statItemLabel}>{type}</span>
            <span className={styles.statItemCount}>{count}</span>
          </div>
        ))}
      </div>

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
            <MapFlyTo target={flyTarget} />
            {markableReports.map((report) => (
              <Marker key={report.id} position={[report.latitude, report.longitude]}>
                <Popup>
                  <div className={styles.popup}>
                    <strong
                      style={{
                        color: BADGE_COLORS[report.violationType] || '#3b82d4',
                      }}
                    >
                      {report.violationType}
                    </strong>
                    <span>{new Date(report.timestamp).toLocaleString()}</span>
                    {report.description && (
                      <em className={styles.popupDesc}>{report.description}</em>
                    )}
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
          {/* Filter + search controls */}
          <div className={styles.controls}>
            <input
              className={styles.searchInput}
              type="search"
              placeholder="Search violations or notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className={styles.filterSelect}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              {VIOLATION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className={styles.sidebarTitleRow}>
            <h2 className={styles.sidebarTitle}>
              Reports{' '}
              <span className={styles.count}>
                {filtered.length !== reports.length
                  ? `${filtered.length} / ${reports.length}`
                  : reports.length}
              </span>
            </h2>
          </div>

          {filtered.length === 0 && (
            <p className={styles.empty}>
              {reports.length === 0
                ? 'No reports yet. Waiting for submissions…'
                : 'No reports match your filters.'}
            </p>
          )}

          <ul className={styles.list}>
            {filtered.map((report) => (
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
                  <span
                    className={styles.badge}
                    style={{ background: BADGE_COLORS[report.violationType] || '#3b82d4' }}
                  >
                    {report.violationType}
                  </span>
                  {report.description && (
                    <span className={styles.cardDesc}>{report.description}</span>
                  )}
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
                <button
                  className={styles.deleteBtn}
                  title="Delete report"
                  onClick={() => handleDelete(report.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}
