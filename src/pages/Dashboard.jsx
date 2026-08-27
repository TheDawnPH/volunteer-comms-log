import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Modal from '../components/Modal.jsx'
import { isBirthdayWeek, isBirthdayToday } from '../lib/timezone.js'

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

const BIRTHDAY_POPUP_SEEN_KEY = 'roster-birthday-popup-seen'

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const tiles = profile?.role === 'admin' ? adminTiles : volunteerTiles
  const [showBirthdayPopup, setShowBirthdayPopup] = useState(false)

  const birthdayWeek = isBirthdayWeek(profile?.date_of_birth)
  const birthdayToday = isBirthdayToday(profile?.date_of_birth)
  const firstName = profile?.nickname || profile?.full_name?.split(' ')[0] || 'crew member'

  useEffect(() => {
    if (!birthdayWeek || !profile?.id) return
    // Show the full popout once per birthday week per device, so it
    // doesn't nag on every single page visit.
    const seenKey = `${BIRTHDAY_POPUP_SEEN_KEY}:${profile.id}`
    const alreadySeen = sessionStorage.getItem(seenKey)
    if (!alreadySeen) {
      setShowBirthdayPopup(true)
      sessionStorage.setItem(seenKey, '1')
    }
  }, [birthdayWeek, profile?.id])

  return (
    <div>
      <h2>Welcome back, {firstName} 👋</h2>
      <p style={{ marginBottom: birthdayWeek ? 12 : 24 }}>Here's what's available to you today.</p>

      {birthdayWeek && (
        <div className="card card-pad birthday-banner" style={{ marginBottom: 24 }}>
          🎉 <strong>Happy {birthdayToday ? 'Birthday' : 'Birthday Week'}, {firstName}!</strong> Wishing you a great one — from the Media and Technology Department. 🎂
        </div>
      )}

      <div className="tile-grid">
        {tiles.map((t, i) => (
          <div className="tile" key={t.to} onClick={() => navigate(t.to)}>
            <span className="icon-badge" style={{ background: tileStyles[i % tileStyles.length].bg, color: tileStyles[i % tileStyles.length].fg }}>{t.icon}</span>
            <h3 style={{ fontSize: '1.05rem' }}>{t.title}</h3>
            <p>{t.desc}</p>
          </div>
        ))}
      </div>

      {showBirthdayPopup && (
        <Modal title="🎉 Happy Birthday!" onClose={() => setShowBirthdayPopup(false)}
          footer={<button className="btn btn-primary" onClick={() => setShowBirthdayPopup(false)}>Thank you!</button>}>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: '2.6rem', marginBottom: 12 }}>🎂🎈🎊</div>
            <p style={{ color: 'var(--ink)', fontSize: '1.02rem' }}>
              Happy {birthdayToday ? 'Birthday' : 'Birthday Week'}, {firstName}!
            </p>
            <p className="hint-text">With appreciation, from the Media and Technology Department.</p>
          </div>
        </Modal>
      )}
    </div>
  )
}
