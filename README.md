# Traffic Violation Reporter

A fully anonymous web application that allows citizens to report traffic violations in real time. Reports are pushed live to an authority dashboard via WebSocket and displayed on an interactive map.

---

## Features

- **Anonymous reporting** — no login, no IP logging, no identity fields
- **Camera capture** — open the device camera and snap a photo directly in the browser
- **File upload** — alternatively upload an existing photo from the device gallery
- **GPS auto-fill** — latitude and longitude are captured automatically from the browser's Geolocation API
- **EXIF extraction** — image metadata is parsed and stored with each report
- **Live dashboard** — authority view with a Leaflet.js map and a sidebar list; new reports appear in real time via WebSocket without page refresh
- **Flat-file storage** — no database required; reports are persisted to `server/data/reports.json`

---

## Prerequisites

- **Node.js** v18 or later
- **npm** v9 or later (comes with Node.js)

---

## Install

From the project root, install all workspace dependencies in one command:

```bash
npm install
```

---

## Run

Start both the client (Vite, port 5173) and the server (Express, port 3001) concurrently:

```bash
npm run dev
```

Then open your browser:

| Page | URL |
|---|---|
| Citizen report form | http://localhost:5173/ |
| Authority dashboard | http://localhost:5173/dashboard |

---

## Project Structure

```
traffic-violation-reporter/
├── client/                    React + Vite frontend
│   └── src/
│       ├── App.jsx            React Router setup
│       ├── leaflet-setup.js   Leaflet marker icon fix for Vite
│       └── pages/
│           ├── ReportPage.jsx      Citizen submission form
│           └── DashboardPage.jsx   Authority live dashboard
├── server/                    Node.js + Express backend
│   ├── index.js               HTTP server + WebSocket server
│   ├── routes/
│   │   └── reports.js         POST and GET /api/reports
│   └── data/
│       └── reports.json       Flat-file report store
└── package.json               Monorepo root with workspaces
```

---

## API

### `POST /api/reports`
Submit a new violation report.

**Body (multipart/form-data):**
| Field | Type | Description |
|---|---|---|
| `violationType` | string | One of the fixed violation type options |
| `latitude` | number | GPS latitude (optional) |
| `longitude` | number | GPS longitude (optional) |
| `timestamp` | string | ISO 8601 datetime |
| `image` | file | Photo evidence |

**Response:** `201 Created` — the saved report object as JSON.

### `GET /api/reports`
Returns all reports sorted newest-first.

### `WebSocket ws://localhost:3001/ws`
Broadcasts `{ type: "new_report", report: {...} }` to all connected clients on each new submission.

---

## Privacy

- No IP address is stored
- No user account or login required
- No cookies or session data
- Reports contain only: violation type, coordinates, timestamp, photo, and EXIF metadata
