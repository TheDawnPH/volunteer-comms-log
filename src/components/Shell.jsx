import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import ThemeToggle from './ThemeToggle.jsx'

const volunteerNav = [
  { section: 'Crew' },
  { to: '/announcements', label: 'Announcements', icon: '📣' },
  { to: '/schedules', label: 'My Schedule', icon: '🗓️' },
  { to: '/comms', label: 'Comms Login / Logout', icon: '🎧' }
]

const adminNav = [
  { section: 'Operations' },
  { to: '/announcements', label: 'Announcements', icon: '📣' },
  { to: '/schedules', label: 'Schedules', icon: '🗓️' },
  { section: 'People' },
  { to: '/volunteers', label: 'Volunteer Management', icon: '🧑‍🤝‍🧑' },
  { to: '/admins', label: 'Administrator Management', icon: '🛡️' },
  { section: 'Comms' },
  { to: '/comms-equipment', label: 'Comms Equipment', icon: '🎧' },
  { to: '/attendance', label: 'Volunteer Attendance', icon: '✅' }
]

export default function Shell({ children }) {
  const { profile, isAdmin, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const nav = isAdmin ? adminNav : volunteerNav

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="dot" />
          <h1>MAT Volunteer System</h1>
        </div>
        {nav.map((item, i) =>
          item.section ? (
            <div className="nav-section-label" key={i}>{item.section}</div>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
              onClick={() => setOpen(false)}
            >
              <span>{item.icon}</span> {item.label}
            </NavLink>
          )
        )}
        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
          <button className="nav-link" onClick={handleSignOut}>🚪 Sign out</button>
        </div>
      </aside>

      <div className="main-col">
        <div className="topbar">
          <button className="btn btn-secondary btn-sm hamburger-btn" onClick={() => setOpen(o => !o)}>☰ Menu</button>
          <div style={{ flex: 1 }} />
          <ThemeToggle />
          <div style={{ marginLeft: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`badge-role-pill`} style={{ marginBottom: 0 }}>{profile?.role || '—'}</span>
            <strong>{profile?.full_name || profile?.nickname || 'Crew member'}</strong>
          </div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  )
}
