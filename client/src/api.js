/**
 * Centralised API / WebSocket URL helpers.
 *
 * In development (Vite proxy active):
 *   VITE_API_BASE_URL is empty → relative paths like /api/reports work fine.
 *
 * In production (deployed frontend, separate backend):
 *   Set VITE_API_BASE_URL=https://your-backend.example.com in Vercel env vars.
 *   Optionally set VITE_WS_URL=wss://your-backend.example.com/ws.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

/**
 * Returns an absolute or root-relative URL for a given API path.
 * @param {string} path - e.g. '/api/reports'
 */
export function apiUrl(path) {
  return `${API_BASE}${path}`
}

/**
 * Returns the WebSocket URL for the live-reports stream.
 */
export function wsUrl() {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL
  }
  if (API_BASE) {
    // Derive ws(s):// from http(s)://
    return API_BASE.replace(/^http/, 'ws') + '/ws'
  }
  // Dev fallback: same host, port 3001
  return `ws://${window.location.hostname}:3001/ws`
}
