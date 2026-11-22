const express = require('express')
const multer = require('multer')
const { v4: uuidv4 } = require('uuid')
const exifr = require('exifr')
const fs = require('fs')
const path = require('path')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

const DATA_FILE = path.join(__dirname, '..', 'data', 'reports.json')

function readReports() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  } catch {
    return []
  }
}

function writeReports(reports) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(reports, null, 2), 'utf8')
}

// POST /api/reports
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { violationType, latitude, longitude, timestamp, description } = req.body

    let imageData = null
    let exif = null

    if (req.file) {
      imageData = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
      try {
        exif = await exifr.parse(req.file.buffer)
      } catch {
        exif = null
      }
    }

    const report = {
      id: uuidv4(),
      violationType,
      description: description ? description.trim() : '',
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      timestamp: timestamp || new Date().toISOString(),
      imageData,
      exif: exif || {},
    }

    const reports = readReports()
    reports.unshift(report)
    writeReports(reports)

    // Broadcast to all WebSocket clients
    if (req.broadcast) {
      req.broadcast({ type: 'new_report', report })
    }

    res.status(201).json(report)
  } catch (err) {
    console.error('POST /api/reports error:', err)
    res.status(500).json({ error: 'Failed to save report' })
  }
})

// GET /api/reports
router.get('/', (_req, res) => {
  try {
    const reports = readReports()
    // Already stored newest-first; sort by timestamp descending to be safe
    reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    res.json(reports)
  } catch (err) {
    console.error('GET /api/reports error:', err)
    res.status(500).json({ error: 'Failed to read reports' })
  }
})

// DELETE /api/reports/:id
router.delete('/:id', (req, res) => {
  try {
    const reports = readReports()
    const idx = reports.findIndex((r) => r.id === req.params.id)
    if (idx === -1) return res.status(404).json({ error: 'Report not found' })
    const [deleted] = reports.splice(idx, 1)
    writeReports(reports)
    if (req.broadcast) {
      req.broadcast({ type: 'delete_report', id: deleted.id })
    }
    res.json({ deleted: deleted.id })
  } catch (err) {
    console.error('DELETE /api/reports/:id error:', err)
    res.status(500).json({ error: 'Failed to delete report' })
  }
})

module.exports = router
