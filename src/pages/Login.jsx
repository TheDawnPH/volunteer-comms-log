import React, { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'

export default function Login() {
  const { session, loginWithPin } = useAuth()
  const [mode, setMode] = useState('volunteer') // 'volunteer' | 'admin'
  const [loginCode, setLoginCode] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await loginWithPin(loginCode, pin)
      // role is checked downstream by RLS + the dashboard; if an admin PIN
      // is entered on the volunteer tab (or vice versa) the dashboard just
      // reflects the profile's true role.
    } catch (err) {
      setError(err.message || 'Is correct? No — please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <div style={{ position: 'absolute', top: 20, right: 20 }}><ThemeToggle /></div>
      <div className="badge-card">
        <div className="badge-strap" />
        <span className="badge-role-pill">{mode === 'admin' ? 'Administrator' : 'Volunteer'}</span>
        <h2 style={{ marginBottom: 4 }}>Roster</h2>
        <p style={{ marginBottom: 20 }}>Sign in with your username and PIN.</p>

        <div className="theme-toggle" style={{ display: 'inline-flex', marginBottom: 20 }}>
          <button className={mode === 'volunteer' ? 'active' : ''} onClick={() => setMode('volunteer')} type="button">Volunteer</button>
          <button className={mode === 'admin' ? 'active' : ''} onClick={() => setMode('admin')} type="button">Administrator</button>
        </div>

        {error && <div className="error-text">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="loginCode">Username</label>
            <input id="loginCode" value={loginCode} onChange={e => setLoginCode(e.target.value.toLowerCase())} autoCapitalize="none" autoCorrect="off" spellCheck={false} required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="pin">PIN</label>
            <input id="pin" className="pin-input" type="password" inputMode="numeric" maxLength={8}
              value={pin} onChange={e => setPin(e.target.value)} required />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Checking…' : 'Log in'}
          </button>
        </form>

        <p style={{ marginTop: 16 }}>
          <Link to="/forgot-pin" className="hint-text">Forgot PIN?</Link>
        </p>
      </div>
    </div>
  )
}
