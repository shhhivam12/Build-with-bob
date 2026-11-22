import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import ReportPage from './pages/ReportPage'
import DashboardPage from './pages/DashboardPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <nav className="app-nav">
        <Link to="/">📸 Report a Violation</Link>
        <Link to="/dashboard">🗺️ Authority Dashboard</Link>
      </nav>
      <Routes>
        <Route path="/" element={<ReportPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
