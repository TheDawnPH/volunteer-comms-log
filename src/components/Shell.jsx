import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useBranding } from '../context/BrandingContext.jsx'
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
  const { logoUrl, appName } = useBranding()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const nav = isAdmin ? adminNav : volunteerNav

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  function goHome() {
    setOpen(false)
    navigate('/')
  }

  return (
    <div className="app-shell">
      {/* Tapping outside the open mobile menu closes it */}
      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} />}

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <button className="sidebar-brand" onClick={goHome} aria-label="Go to homepage" type="button">
          {logoUrl ? <img src={logoUrl} alt="" className="brand-logo" /> : <span className="dot" />}
          <h1>{appName || 'Roster'}</h1>
        </button>
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
          {/* Theme + profile move into the burger menu on small screens */}
          <div className="sidebar-mobile-extra">
            <ThemeToggle />
            <div className="sidebar-profile">
              <span className="badge-role-pill" style={{ marginBottom: 0 }}>{profile?.role || '—'}</span>
              <strong>{profile?.full_name || profile?.nickname || 'Crew member'}</strong>
            </div>
          </div>
          <button className="nav-link" onClick={handleSignOut}>🚪 Sign out</button>
        </div>
      </aside>

      <div className="main-col">
        <div className="topbar">
          <button className="btn btn-secondary btn-sm hamburger-btn" onClick={() => setOpen(o => !o)} aria-label="Toggle menu">☰ Menu</button>
          <button className="topbar-brand-mobile" onClick={goHome} aria-label="Go to homepage" type="button">
            {logoUrl ? <img src={logoUrl} alt="" className="brand-logo brand-logo-sm" /> : <span className="dot" />}
            <span>{appName || 'Roster'}</span>
          </button>
          <div style={{ flex: 1 }} />
          <div className="topbar-desktop-extra">
            <ThemeToggle />
            <div style={{ marginLeft: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="badge-role-pill" style={{ marginBottom: 0 }}>{profile?.role || '—'}</span>
              <strong>{profile?.full_name || profile?.nickname || 'Crew member'}</strong>
            </div>
          </div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  )
}
