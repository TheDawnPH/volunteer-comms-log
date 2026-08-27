import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import DataTable from '../components/DataTable.jsx'
import QrScanner from '../components/QrScanner.jsx'
import { formatManila } from '../lib/timezone.js'

/*
 * Mirrors "Comms Login/Logout" in the flowchart:
 *  1. Scan the QR code from a comms headset with the phone camera, or
 *     — if the camera isn't available — type the headset's QR value
 *     OR its plain name (whichever is easier to read off the unit).
 *  2. Is timed IN? -> look for an OPEN log row (status='in') for this
 *     volunteer+headset.
 *     - true  -> Time OUT: close that row, set status='out',
 *                Release Headset (equipment.status='available').
 *     - false -> Is the headset NOT used by another volunteer?
 *         - true  -> Time IN: create a new open row,
 *                    Lock Headset (equipment.status='in_use').
 *         - false -> Throw Error: headset is used by another volunteer.
 */
export default function CommsLogin() {
  const { profile } = useAuth()
  const [mode, setMode] = useState('camera') // 'camera' | 'manual'
  const [manualValue, setManualValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'error'|'success', text }
  const [myLogs, setMyLogs] = useState([])

  useEffect(() => { loadMyLogs() }, [])

  async function loadMyLogs() {
    const { data } = await supabase
      .from('comms_logs')
      .select('*, comms_equipment(name)')
      .eq('profile_id', profile.id)
      .order('time_in', { ascending: false })
      .limit(20)
    setMyLogs(data || [])
  }

  async function lookupEquipment(rawValue) {
    const value = rawValue.trim()
    if (!value) throw new Error('Enter or scan a headset QR value or name.')

    // Try an exact QR-value match first (what the camera decodes), then
    // fall back to a case-insensitive name match for manual entry.
    const { data: byQr } = await supabase.from('comms_equipment').select('*').eq('qr_value', value).maybeSingle()
    if (byQr) return byQr

    const { data: byName } = await supabase.from('comms_equipment').select('*').ilike('name', value).maybeSingle()
    if (byName) return byName

    throw new Error('Unrecognized QR code / headset name.')
  }

  async function processScan(rawValue) {
    if (busy) return
    setBusy(true); setMessage(null)
    try {
      const equipment = await lookupEquipment(rawValue)

      // Is this volunteer already timed in on this headset?
      const { data: myOpen } = await supabase
        .from('comms_logs').select('*')
        .eq('equipment_id', equipment.id).eq('profile_id', profile.id).eq('status', 'in')
        .maybeSingle()

      if (myOpen) {
        // TIME OUT — release the headset
        await supabase.from('comms_logs').update({ time_out: new Date().toISOString(), status: 'out' }).eq('id', myOpen.id)
        await supabase.from('comms_equipment').update({ status: 'available' }).eq('id', equipment.id)
        setMessage({ type: 'success', text: `Timed OUT of ${equipment.name}. Headset released.` })
      } else {
        // Is the headset NOT used by another volunteer?
        const { data: otherOpen } = await supabase
          .from('comms_logs').select('*').eq('equipment_id', equipment.id).eq('status', 'in').maybeSingle()

        if (otherOpen) {
          throw new Error(`Headset is used by another volunteer. Ask them to time out first.`)
        }
        // TIME IN — lock the headset
        await supabase.from('comms_logs').insert({ equipment_id: equipment.id, profile_id: profile.id, status: 'in' })
        await supabase.from('comms_equipment').update({ status: 'in_use' }).eq('id', equipment.id)
        setMessage({ type: 'success', text: `Timed IN on ${equipment.name}. Headset locked to you.` })
      }
      setManualValue('')
      loadMyLogs()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  function handleManualSubmit(e) {
    e.preventDefault()
    processScan(manualValue)
  }

  return (
    <div>
      <h2>Comms Login / Logout</h2>
      <p style={{ marginBottom: 20 }}>Scan a headset's QR code with your camera, or switch to manual entry and type its QR value or name.</p>

      <div className="card card-pad" style={{ maxWidth: 460, marginBottom: 24 }}>
        {message && <div className={message.type === 'error' ? 'error-text' : 'error-text'} style={message.type === 'success' ? { background: 'var(--sage)', color: 'var(--sage-ink)' } : {}}>{message.text}</div>}

        <div className="theme-toggle" style={{ display: 'inline-flex', marginBottom: 16 }}>
          <button type="button" className={mode === 'camera' ? 'active' : ''} onClick={() => setMode('camera')}>📷 Scan</button>
          <button type="button" className={mode === 'manual' ? 'active' : ''} onClick={() => setMode('manual')}>⌨️ Manual entry</button>
        </div>

        {mode === 'camera' ? (
          <>
            <QrScanner
              active={mode === 'camera'}
              onScan={(text) => processScan(text)}
              onError={() => setMode('manual')}
            />
            <p className="hint-text" style={{ textAlign: 'center', marginTop: 12 }}>
              Point your camera at the QR code printed on the headset.{' '}
              {busy && 'Processing…'}
            </p>
          </>
        ) : (
          <form onSubmit={handleManualSubmit}>
            <div className="field">
              <label>Headset QR value or name</label>
              <input value={manualValue} onChange={e => setManualValue(e.target.value)} placeholder="e.g. HEADSET-04 or Headset 4" required autoFocus />
              <p className="hint-text">If the QR code isn't available to scan, the headset's plain name works too.</p>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Checking…' : 'Submit'}</button>
          </form>
        )}
      </div>

      <DataTable
        title="My recent comms activity"
        columns={[
          { key: 'headset', label: 'Headset', render: r => r.comms_equipment?.name },
          { key: 'time_in', label: 'Time IN', render: r => formatManila(r.time_in) },
          { key: 'time_out', label: 'Time OUT', render: r => r.time_out ? formatManila(r.time_out) : '—' },
          { key: 'status', label: 'Status', render: r => <span className={`tag ${r.status === 'in' ? 'tag-in' : 'tag-out'}`}>{r.status === 'in' ? 'Locked / IN' : 'Released / OUT'}</span> }
        ]}
        rows={myLogs}
        emptyText="No comms activity yet."
      />
    </div>
  )
}
