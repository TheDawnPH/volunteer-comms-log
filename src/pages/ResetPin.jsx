import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Landing page for the Supabase "Reset User Account Link" email.
// Supabase's redirect already signs the user into a temporary session;
// this screen is the "Change PIN" step from the flowchart.
export default function ResetPin() {
  const { changePin } = useAuth()
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (pin.length < 4) return setError('PIN must be at least 4 digits.')
    if (pin !== confirm) return setError('PINs do not match.')
    setBusy(true)
    try {
      await changePin(pin)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="badge-card">
        <div className="badge-strap" />
        <span className="badge-role-pill">Change PIN</span>
        <h2>Set a new PIN</h2>
        <p>Pick a PIN that isn't used by any other volunteer's badge.</p>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-text">{error}</div>}
          <div className="field">
            <label htmlFor="pin">New PIN</label>
            <input id="pin" className="pin-input" type="password" inputMode="numeric" value={pin} onChange={e => setPin(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="confirm">Confirm PIN</label>
            <input id="confirm" className="pin-input" type="password" inputMode="numeric" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Saving…' : 'Change PIN'}</button>
        </form>
      </div>
    </div>
  )
}
