import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import { lookupEquipment, toggleCommsLog } from '../lib/commsLogin.js'
import { formatManila } from '../lib/timezone.js'
import QrScanner from './QrScanner.jsx'

/**
 * Lets an admin log a GUEST (someone not registered as a volunteer or
 * staff/admin) in or out of a comms headset — just their name, no
 * account needed. Guests can never do this themselves; it only lives
 * on the admin side (Comms Equipment page).
 */
export default function GuestCommsLogin() {
  const { profile } = useAuth()
  const [mode, setMode] = useState('manual') // 'camera' | 'manual'
  const [equipmentValue, setEquipmentValue] = useState('')
  const [guestName, setGuestName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [activeGuests, setActiveGuests] = useState([])

  useEffect(() => { loadActiveGuests() }, [])

  async function loadActiveGuests() {
    const { data } = await supabase
      .from('comms_logs')
      .select('*, comms_equipment(name)')
      .is('profile_id', null)
      .eq('status', 'in')
      .order('time_in', { ascending: false })
    setActiveGuests(data || [])
  }

  async function submit(rawEquipmentValue, name) {
    if (busy) return
    if (!name || !name.trim()) {
      setMessage({ type: 'error', text: "Enter the guest's name." })
      return
    }
    setBusy(true); setMessage(null)
    try {
      const equipment = await lookupEquipment(supabase, rawEquipmentValue)
      const { action } = await toggleCommsLog(supabase, equipment, { type: 'guest', guestName: name, createdBy: profile.id })
      setMessage(action === 'out'
        ? { type: 'success', text: `Timed OUT ${name.trim()} from ${equipment.name}. Headset released.` }
        : { type: 'success', text: `Timed IN ${name.trim()} on ${equipment.name}. Headset locked.` })
      setEquipmentValue(''); setGuestName('')
      loadActiveGuests()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  function handleManualSubmit(e) {
    e.preventDefault()
    submit(equipmentValue, guestName)
  }

  async function quickTimeOut(row) {
    if (busy) return
    setBusy(true); setMessage(null)
    try {
      await toggleCommsLog(supabase, { id: row.equipment_id, name: row.comms_equipment?.name || 'headset' }, { type: 'guest', guestName: row.guest_name })
      setMessage({ type: 'success', text: `Timed OUT ${row.guest_name} from ${row.comms_equipment?.name}. Headset released.` })
      loadActiveGuests()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card card-pad" style={{ marginBottom: 24 }}>
      <h3 style={{ marginTop: 0 }}>Guest Comms Login</h3>
      <p className="hint-text" style={{ marginBottom: 16 }}>For someone not registered in the system — capture just their name, admin-side only.</p>

      {message && (
        <div className={message.type === 'error' ? 'error-text' : 'error-text'} style={message.type === 'success' ? { background: 'var(--sage)', color: 'var(--sage-ink)' } : {}}>
          {message.text}
        </div>
      )}

      <div className="theme-toggle" style={{ display: 'inline-flex', marginBottom: 16 }}>
        <button type="button" className={mode === 'manual' ? 'active' : ''} onClick={() => setMode('manual')}>⌨️ Manual entry</button>
        <button type="button" className={mode === 'camera' ? 'active' : ''} onClick={() => setMode('camera')}>📷 Scan headset</button>
      </div>

      {mode === 'camera' ? (
        <div style={{ marginBottom: 16 }}>
          <div className="field">
            <label>Guest name</label>
            <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="e.g. Juan Dela Cruz" required autoFocus />
          </div>
          <QrScanner
            active={mode === 'camera'}
            onScan={(text) => submit(text, guestName)}
            onError={() => setMode('manual')}
          />
          <p className="hint-text" style={{ textAlign: 'center', marginTop: 12 }}>
            Enter the guest's name above, then scan the headset's QR code. {busy && 'Processing…'}
          </p>
        </div>
      ) : (
        <form onSubmit={handleManualSubmit} style={{ marginBottom: 16 }}>
          <div className="field">
            <label>Guest name</label>
            <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="e.g. Juan Dela Cruz" required />
          </div>
          <div className="field">
            <label>Headset QR value or name</label>
            <input value={equipmentValue} onChange={e => setEquipmentValue(e.target.value)} placeholder="e.g. HEADSET-04 or Headset 4" required />
          </div>
          <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Checking…' : 'Time in / out'}</button>
        </form>
      )}

      <h4 style={{ margin: '20px 0 8px', fontSize: '0.95rem' }}>Guests currently checked in</h4>
      {activeGuests.length === 0 && <p className="hint-text">No guests currently timed in.</p>}
      {activeGuests.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {activeGuests.map(g => (
            <li key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span>
                <strong>{g.guest_name}</strong>
                <span className="hint-text"> — {g.comms_equipment?.name} · in since {formatManila(g.time_in)}</span>
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => quickTimeOut(g)} disabled={busy}>Time out</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
