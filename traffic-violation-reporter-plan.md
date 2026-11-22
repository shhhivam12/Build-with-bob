# Traffic Violation Reporter — Implementation Plan

## Top-Level Overview

Build a fully anonymous web application that allows citizens to report traffic violations on city roads in real time. Users can capture or upload a photo, select a violation type from a fixed picklist, and have location/time metadata auto-captured. Reports are stored in a flat JSON file on the server and pushed in real time to a local authority dashboard via WebSocket. The dashboard includes a live map view powered by Leaflet.js.

**Stack:** React (Vite) + Node.js/Express + WebSocket (ws) + Leaflet.js  
**Data store:** Flat `reports.json` file (no database)  
**Anonymity:** No login, no IP logging, no identity fields — purely data-only submission

---

## Sub-Tasks

---

### Sub-Task 1 — Project Scaffolding

**Status:** [ ] pending

**Intent**  
Set up the monorepo project structure with separate `client` (React/Vite) and `server` (Node/Express) packages under a single root. Establish conventions, shared scripts, and ensure both packages can be started together with one command.

**Expected Outcomes**
- Root `package.json` with `workspaces`, `dev` script that starts both client and server concurrently
- `client/` bootstrapped with Vite + React (no TypeScript needed)
- `server/` with Express installed, basic `index.js` that returns a 200 health check on `GET /api/health`
- `client/` Vite proxy configured to forward `/api` and WebSocket requests to `localhost:3001`
- Project runs with `npm run dev` from root

**Todo List**
1. Create root `package.json` with `workspaces: ["client", "server"]` and a `concurrently` dev script
2. Scaffold `client/` using `npm create vite@latest` with the React template
3. Configure `client/vite.config.js` to proxy `/api` → `http://localhost:3001` and WebSocket → `ws://localhost:3001`
4. Create `server/package.json` and install `express`, `cors`, `ws`, `uuid`, `exifr`, `multer`
5. Create `server/index.js` with a basic Express app listening on port 3001 with a `GET /api/health` route
6. Create `server/data/reports.json` as an empty array `[]`
7. Verify `npm run dev` from root starts both client (port 5173) and server (port 3001)

**Relevant Context**
- Greenfield project — no existing code to reference
- Use `concurrently` at the root level to start both processes

---

### Sub-Task 2 — Backend: Report Storage and API

**Status:** [ ] pending

**Intent**  
Implement the server-side REST API for submitting and retrieving violation reports. Reports are persisted to `reports.json`. The image is stored as a base64 string inside the JSON record. No IP or identity information is ever stored.

**Expected Outcomes**
- `POST /api/reports` accepts a multipart form with: `violationType`, `latitude`, `longitude`, `timestamp`, `image` (file) and returns the saved report as JSON
- `GET /api/reports` returns all reports from `reports.json` sorted by newest first
- Each report record contains: `id` (uuid), `violationType`, `latitude`, `longitude`, `timestamp`, `imageData` (base64), `exif` (extracted EXIF object)
- IP address is explicitly NOT recorded in the report
- On each `POST`, the server broadcasts the new report to all connected WebSocket clients

**Todo List**
1. Create `server/routes/reports.js` with Express Router
2. Implement `POST /api/reports`: use `multer` (memory storage) to receive the image, extract EXIF using `exifr.parse()`, build a report object with a `uuid`, write to `reports.json`, emit WebSocket broadcast, return the report
3. Implement `GET /api/reports`: read `reports.json`, return sorted array
4. Mount the router in `server/index.js` under `/api/reports`
5. Set up the `ws` WebSocket server attached to the Express HTTP server in `server/index.js`; expose a `broadcast(data)` helper used by the reports route
6. Add `cors` middleware allowing the Vite dev origin

**Relevant Context**
- `exifr` is a lightweight EXIF parser that works in Node.js on a Buffer
- `multer` with `memoryStorage()` gives access to `req.file.buffer` without writing to disk
- The WebSocket server should be attached to the same HTTP server as Express (not a separate port)
- `reports.json` path: `server/data/reports.json`

---

### Sub-Task 3 — Frontend: Report Submission Form

**Status:** [ ] pending

**Intent**  
Build the citizen-facing report submission page. Users can capture a photo via device camera or upload from gallery, select a violation type, and have GPS coordinates auto-populated. On submit the form posts to the backend API anonymously.

**Expected Outcomes**
- `ReportPage.jsx` renders at route `/`
- Camera capture: button opens a live video stream via `navigator.mediaDevices.getUserMedia`, user clicks "Capture" to snap a still frame to a canvas, result shown as preview
- File upload: separate "Upload Photo" button opens a native file picker; preview shown on selection
- Violation type `<select>` with these fixed options: Red Light Jumping, Wrong-Way Driving, No Helmet, Speeding, Illegal Parking, Using Phone While Driving, Drunk Driving, Overloading
- On page load, `navigator.geolocation.getCurrentPosition` auto-fills read-only latitude/longitude fields
- Date and time fields are auto-filled with current local time (read-only, user cannot change)
- "Submit Report" button POSTs a `FormData` to `POST /api/reports`; on success shows a brief confirmation message and resets the form
- Form is fully usable on mobile viewport

**Todo List**
1. Install React Router in `client/` and set up routes for `/` (ReportPage) and `/dashboard` (DashboardPage placeholder)
2. Create `client/src/pages/ReportPage.jsx` with the form layout
3. Implement the camera capture sub-component: `getUserMedia` → `<video>` preview → canvas snapshot → blob/base64 preview image
4. Implement file upload input wired to show a preview `<img>` on selection
5. Implement geolocation auto-fill on mount with a fallback message if permission is denied
6. Implement auto date/time fill on mount (read-only fields)
7. Implement the `handleSubmit` function: build `FormData`, POST to `/api/reports`, handle success/error states
8. Apply basic responsive CSS (can be plain CSS modules or inline styles — keep it simple)

**Relevant Context**
- `getUserMedia` requires HTTPS or localhost — works fine in Vite dev mode
- Canvas snapshot: draw `<video>` frame to a 2D canvas, then `canvas.toBlob()` to get a File-like object for FormData
- Use `URL.createObjectURL` for instant file upload preview

---

### Sub-Task 4 — Frontend: Authority Dashboard with Map

**Status:** [ ] pending

**Intent**  
Build the authority-facing dashboard at `/dashboard` that shows all submitted reports in real time. A Leaflet.js map displays report locations as markers. A sidebar lists reports with thumbnail, violation type, and timestamp. New reports appear live via WebSocket without page refresh.

**Expected Outcomes**
- `DashboardPage.jsx` renders at route `/dashboard`
- On mount, fetches all existing reports from `GET /api/reports` and renders them
- Opens a WebSocket connection to `ws://localhost:3001` (proxied by Vite in dev); on message receipt, adds the new report to state without re-fetching
- Leaflet map fills the main area; each report appears as a default marker at its lat/long; clicking a marker shows a popup with violation type, timestamp, and thumbnail
- Sidebar panel lists reports newest-first with: thumbnail image, violation type badge, coordinates, timestamp
- New reports animate into the top of the sidebar list
- Dashboard is clearly labelled "Authority View — Live Reports" to distinguish it from the citizen form

**Todo List**
1. Install `leaflet` and `react-leaflet` in `client/`
2. Create `client/src/pages/DashboardPage.jsx`
3. Implement initial data load via `useEffect` calling `GET /api/reports`
4. Implement WebSocket connection in `useEffect`; parse incoming JSON messages and prepend to report state
5. Render `<MapContainer>` with OpenStreetMap tiles centered on a default city coordinate (can be configurable via a constant)
6. For each report with valid lat/long, render a `<Marker>` with a `<Popup>` showing violation type, timestamp, and `<img>` thumbnail
7. Render the sidebar report list with CSS grid/flex layout
8. Add a simple "live" indicator (green dot + "Live" text) that pulses when a new report arrives
9. Handle the case where a report has no lat/long (geolocation denied) — omit marker but still show in sidebar

**Relevant Context**
- `react-leaflet` v4+ requires `leaflet` CSS to be imported: `import 'leaflet/dist/leaflet.css'`
- Leaflet default marker icons break in Vite — fix by importing marker icons explicitly in a `leaflet-setup.js` file
- WebSocket URL in dev: Vite proxy forwards `ws` upgrades on `/ws` path (configure proxy accordingly) or connect directly to `ws://localhost:3001`
- Image thumbnails: use `imageData` base64 field directly in `<img src={report.imageData} />`

---

### Sub-Task 5 — Integration and End-to-End Validation

**Status:** [ ] pending

**Intent**  
Wire everything together, verify the full user journey end-to-end, and ensure no identity/IP data leaks into stored reports.

**Expected Outcomes**
- Submitting a report on `ReportPage` appears on the `DashboardPage` map and sidebar within 1-2 seconds (WebSocket push)
- `reports.json` on the server contains correct fields with no IP or identity fields
- Both pages are navigable via browser URL
- App works on Chrome mobile emulation (responsive layout)
- A `README.md` exists at the project root documenting how to install and run the app

**Todo List**
1. Manually test the full report submission flow: camera capture → select violation → submit → verify dashboard updates
2. Manually test file upload flow
3. Inspect `server/data/reports.json` to confirm no IP field is present
4. Test geolocation denial path: form should show a warning but still allow submission without coordinates
5. Test dashboard with multiple reports: verify map markers and sidebar list both update
6. Verify Leaflet marker icon fix works (no broken icon images)
7. Write `README.md` with: prerequisites, install steps (`npm install` from root), run steps (`npm run dev`), and brief feature description

**Relevant Context**
- All sub-tasks 1–4 must be complete before this validation sub-task
- The WebSocket connection in the dashboard should auto-reconnect if the server restarts during development

---

## Architecture Summary

```
Root
├── client/                    React + Vite
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx            React Router setup
│   │   ├── leaflet-setup.js   Leaflet icon fix
│   │   └── pages/
│   │       ├── ReportPage.jsx
│   │       └── DashboardPage.jsx
│   └── vite.config.js         proxy /api and /ws to :3001
└── server/
    ├── index.js               Express + HTTP + WebSocket server
    ├── routes/
    │   └── reports.js         POST and GET handlers
    └── data/
        └── reports.json       flat file store
```
