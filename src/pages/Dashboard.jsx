import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const tileStyles = [
  { bg: 'var(--sage)', fg: 'var(--sage-ink)' },
  { bg: 'var(--lavender)', fg: 'var(--lavender-ink)' },
  { bg: 'var(--apricot)', fg: 'var(--apricot-ink)' },
  { bg: 'var(--sky)', fg: 'var(--sky-ink)' }
]

const volunteerTiles = [
  { to: '/announcements', icon: '📣', title: 'Announcements', desc: 'See the latest posts from the team.' },
  { to: '/schedules', icon: '🗓️', title: 'My Schedule', desc: 'Upcoming shifts, call times, and positions.' },
  { to: '/comms', icon: '🎧', title: 'Comms Login / Logout', desc: 'Scan a headset to time in or out.' }
]

const adminTiles = [
  { to: '/announcements', icon: '📣', title: 'Announcements', desc: 'Post updates for the whole crew.' },
  { to: '/schedules', icon: '🗓️', title: 'Schedules', desc: 'Build shifts and assign volunteers.' },
  { to: '/volunteers', icon: '🧑‍🤝‍🧑', title: 'Volunteer Management', desc: 'Volunteer list and positions.' },
  { to: '/admins', icon: '🛡️', title: 'Administrator Management', desc: 'Staff, comms gear, and attendance.' }
]

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const tiles = profile?.role === 'admin' ? adminTiles : volunteerTiles

  return (
    <div>
      <h2>Welcome back, {profile?.nickname || profile?.full_name?.split(' ')[0] || 'crew member'} 👋</h2>
      <p style={{ marginBottom: 24 }}>Here's what's available to you today.</p>
      <div className="tile-grid">
        {tiles.map((t, i) => (
          <div className="tile" key={t.to} onClick={() => navigate(t.to)}>
            <span className="icon-badge" style={{ background: tileStyles[i % tileStyles.length].bg, color: tileStyles[i % tileStyles.length].fg }}>{t.icon}</span>
            <h3 style={{ fontSize: '1.05rem' }}>{t.title}</h3>
            <p>{t.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
