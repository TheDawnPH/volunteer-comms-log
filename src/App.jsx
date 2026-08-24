import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'

import Login from './pages/Login.jsx'
import ForgotPin from './pages/ForgotPin.jsx'
import ResetPin from './pages/ResetPin.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Announcements from './pages/Announcements.jsx'
import Schedules from './pages/Schedules.jsx'
import CommsLogin from './pages/CommsLogin.jsx'
import VolunteerManagement from './pages/VolunteerManagement.jsx'
import AdminManagement from './pages/AdminManagement.jsx'
import CommsEquipment from './pages/CommsEquipment.jsx'
import Attendance from './pages/Attendance.jsx'
import Shell from './components/Shell.jsx'

function Protected({ children, adminOnly = false }) {
  const { session, profile, loading, isAdmin } = useAuth()
  if (loading) return <div className="login-screen"><p>Loading…</p></div>
  if (!session) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />
  return <Shell>{children}</Shell>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-pin" element={<ForgotPin />} />
      <Route path="/reset-pin" element={<ResetPin />} />

      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/announcements" element={<Protected><Announcements /></Protected>} />
      <Route path="/schedules" element={<Protected><Schedules /></Protected>} />
      <Route path="/comms" element={<Protected><CommsLogin /></Protected>} />

      <Route path="/volunteers" element={<Protected adminOnly><VolunteerManagement /></Protected>} />
      <Route path="/admins" element={<Protected adminOnly><AdminManagement /></Protected>} />
      <Route path="/comms-equipment" element={<Protected adminOnly><CommsEquipment /></Protected>} />
      <Route path="/attendance" element={<Protected adminOnly><Attendance /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
