const http = require('http')
const express = require('express')
const cors = require('cors')
const { WebSocketServer } = require('ws')

const app = express()
const server = http.createServer(app)

// WebSocket server attached to the same HTTP server
const wss = new WebSocketServer({ server, path: '/ws' })

function broadcast(data) {
  const msg = JSON.stringify(data)
  wss.clients.forEach((client) => {
    if (client.readyState === 1 /* OPEN */) {
      client.send(msg)
    }
  })
}

wss.on('connection', (ws) => {
  ws.on('error', console.error)
})

// Middleware
app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

// Routes
const reportsRouter = require('./routes/reports')
app.use('/api/reports', (req, res, next) => {
  req.broadcast = broadcast
  next()
}, reportsRouter)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

const PORT = 3001
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
