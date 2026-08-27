import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ForgotPin() {
  const { forgotPin } = useAuth()
  const [loginCode, setLoginCode] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      await forgotPin(loginCode)
      setSent(true)
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
        <span className="badge-role-pill">Reset</span>
        <h2>Forgot PIN</h2>
        {sent ? (
          <>
            <p>We've sent a reset link to the email on file for that username. Open it to set a new PIN.</p>
            <Link to="/login" className="btn btn-secondary" style={{ width: '100%' }}>Back to login</Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div className="error-text">{error}</div>}
            <div className="field">
              <label htmlFor="code">Username</label>
              <input id="code" value={loginCode} onChange={e => setLoginCode(e.target.value.toLowerCase())} autoCapitalize="none" autoCorrect="off" spellCheck={false} required autoFocus />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
            <p style={{ marginTop: 14 }}><Link to="/login" className="hint-text">Back to login</Link></p>
          </form>
        )}
      </div>
    </div>
  )
}
