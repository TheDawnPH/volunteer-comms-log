import React, { useEffect, useState } from 'react'
import { supabase, uploadFile } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import DataTable from '../components/DataTable.jsx'
import Modal from '../components/Modal.jsx'
import { formatManila, toManilaInputValue, manilaInputToISOString } from '../lib/timezone.js'

const emptySchedule = { id: null, event_name: '', start_time: '', end_time: '', call_time: '', image_url: '' }

export default function Schedules() {
  const { isAdmin, profile } = useAuth()
  const [rows, setRows] = useState([])
  const [volunteers, setVolunteers] = useState([])
  const [positions, setPositions] = useState([])
  const [assignments, setAssignments] = useState({}) // schedule_id -> [{profile_id, position_id, ...}]
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [assigningFor, setAssigningFor] = useState(null)
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: sched }, { data: vols }, { data: pos }, { data: assigns }] = await Promise.all([
      supabase.from('schedules').select('*').order('start_time'),
      supabase.from('profiles').select('id, full_name, nickname').eq('role', 'volunteer'),
      supabase.from('positions').select('*').order('name'),
      supabase.from('schedule_volunteers').select('*, profiles(full_name, nickname), positions(name)')
    ])
    setRows(sched || [])
    setVolunteers(vols || [])
    setPositions(pos || [])
    const grouped = {}
    ;(assigns || []).forEach(a => {
      grouped[a.schedule_id] = grouped[a.schedule_id] || []
      grouped[a.schedule_id].push(a)
    })
    setAssignments(grouped)
  }

  function openEdit(row) {
    // Always populate the datetime-local fields from what's actually
    // saved in the database (converted to Manila wall-clock time),
    // never from stale in-memory state — so re-opening Edit shows the
    // last saved value, not whatever was last typed.
    setEditing({
      id: row.id,
      event_name: row.event_name,
      call_time: toManilaInputValue(row.call_time),
      start_time: toManilaInputValue(row.start_time),
      end_time: toManilaInputValue(row.end_time),
      image_url: row.image_url || ''
    })
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      let image_url = editing.image_url
      if (file) {
        const uploaded = await uploadFile(file, 'schedules')
        image_url = uploaded.url
      }
      const payload = {
        event_name: editing.event_name,
        // Times are always entered/edited as Manila (UTC+8) wall-clock
        // time and converted to a true UTC instant for storage here.
        start_time: manilaInputToISOString(editing.start_time),
        end_time: manilaInputToISOString(editing.end_time),
        call_time: editing.call_time ? manilaInputToISOString(editing.call_time) : null,
        image_url,
        created_by: profile.id
      }
      if (editing.id) {
        const { error } = await supabase.from('schedules').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('schedules').insert(payload)
        if (error) throw error
      }
      setEditing(null); setFile(null)
      load()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this schedule?')) return
    await supabase.from('schedules').delete().eq('id', id)
    load()
  }

  async function addAssignment(scheduleId, profileId, positionId) {
    if (!profileId) return
    await supabase.from('schedule_volunteers').insert({ schedule_id: scheduleId, profile_id: profileId, position_id: positionId || null })
    load()
  }

  async function removeAssignment(id) {
    await supabase.from('schedule_volunteers').delete().eq('id', id)
    load()
  }

  const myPositionFor = (scheduleId) =>
    (assignments[scheduleId] || []).find(a => a.profile_id === profile.id)?.positions?.name || '—'

  return (
    <div>
      <h2>{isAdmin ? 'Schedules' : 'My Schedule'}</h2>
      <p style={{ marginBottom: 20 }}>Event name, call time, start/end, and {isAdmin ? "who's assigned" : 'your position'}. Click a row for the full view.</p>

      <DataTable
        title="Upcoming events"
        columns={[
          { key: 'event_name', label: 'Event' },
          { key: 'call_time', label: 'Call time', render: r => r.call_time ? formatManila(r.call_time) : '—' },
          { key: 'start_time', label: 'Start', render: r => formatManila(r.start_time) },
          { key: 'end_time', label: 'End', render: r => formatManila(r.end_time) },
          isAdmin
            ? { key: 'crew', label: 'Crew', render: r => (assignments[r.id] || []).map(a => a.profiles?.nickname || a.profiles?.full_name).join(', ') || '—' }
            : { key: 'position', label: 'Position', render: r => myPositionFor(r.id) }
        ]}
        rows={rows}
        onAdd={isAdmin ? () => setEditing({ ...emptySchedule }) : undefined}
        addLabel="Add Schedule"
        onRowClick={(r) => setViewing(r)}
        renderActions={isAdmin ? (r) => (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setAssigningFor(r)} style={{ marginRight: 8 }}>Crew</button>
            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(r)} style={{ marginRight: 8 }}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>Delete</button>
          </>
        ) : undefined}
      />

      {viewing && (
        <Modal title={viewing.event_name} onClose={() => setViewing(null)}
          footer={<button className="btn btn-secondary" onClick={() => setViewing(null)}>Close</button>}>
          {viewing.image_url && (
            <img src={viewing.image_url} alt="" style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 12, marginBottom: 16 }} />
          )}
          <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
            {viewing.call_time && <div><strong>Call time:</strong> {formatManila(viewing.call_time)}</div>}
            <div><strong>Start:</strong> {formatManila(viewing.start_time)}</div>
            <div><strong>End:</strong> {formatManila(viewing.end_time)}</div>
            {!isAdmin && <div><strong>Your position:</strong> {myPositionFor(viewing.id)}</div>}
          </div>
          {isAdmin && (
            <>
              <strong>Crew</strong>
              <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0' }}>
                {(assignments[viewing.id] || []).map(a => (
                  <li key={a.id} style={{ padding: '4px 0' }}>
                    {a.profiles?.nickname || a.profiles?.full_name} <span className="hint-text">— {a.positions?.name || 'No position'}</span>
                  </li>
                ))}
                {(assignments[viewing.id] || []).length === 0 && <li className="hint-text">Nobody assigned yet.</li>}
              </ul>
            </>
          )}
        </Modal>
      )}

      {editing && (
        <Modal title={editing.id ? 'Edit schedule' : 'Add schedule'} onClose={() => setEditing(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-primary" form="sched-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </>}>
          {error && <div className="error-text">{error}</div>}
          <form id="sched-form" onSubmit={handleSave}>
            <div className="field"><label>Event name</label>
              <input value={editing.event_name} onChange={e => setEditing({ ...editing, event_name: e.target.value })} required /></div>
            <div className="field"><label>Call time <span className="hint-text">(Philippine time, UTC+8)</span></label>
              <input type="datetime-local" value={editing.call_time} onChange={e => setEditing({ ...editing, call_time: e.target.value })} /></div>
            <div className="field"><label>Start <span className="hint-text">(Philippine time, UTC+8)</span></label>
              <input type="datetime-local" value={editing.start_time} onChange={e => setEditing({ ...editing, start_time: e.target.value })} required /></div>
            <div className="field"><label>End <span className="hint-text">(Philippine time, UTC+8)</span></label>
              <input type="datetime-local" value={editing.end_time} onChange={e => setEditing({ ...editing, end_time: e.target.value })} required /></div>
            <div className="field"><label>Image</label>
              <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} />
              {editing.image_url && !file && <p className="hint-text">Current image will be kept unless you choose a new one.</p>}
            </div>
          </form>
        </Modal>
      )}

      {assigningFor && (
        <Modal title={`Crew — ${assigningFor.event_name}`} onClose={() => setAssigningFor(null)}>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px' }}>
            {(assignments[assigningFor.id] || []).map(a => (
              <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span>{a.profiles?.nickname || a.profiles?.full_name} <span className="hint-text">— {a.positions?.name || 'No position'}</span></span>
                <button className="btn btn-ghost btn-sm" onClick={() => removeAssignment(a.id)}>Remove</button>
              </li>
            ))}
          </ul>
          <AssignForm volunteers={volunteers} positions={positions} onAdd={(pid, posId) => addAssignment(assigningFor.id, pid, posId)} />
        </Modal>
      )}
    </div>
  )
}

function AssignForm({ volunteers, positions, onAdd }) {
  const [pid, setPid] = useState('')
  const [posId, setPosId] = useState('')
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <select value={pid} onChange={e => setPid(e.target.value)} style={{ flex: 1, minWidth: 140 }}>
        <option value="">Volunteer…</option>
        {volunteers.map(v => <option key={v.id} value={v.id}>{v.nickname || v.full_name}</option>)}
      </select>
      <select value={posId} onChange={e => setPosId(e.target.value)} style={{ flex: 1, minWidth: 140 }}>
        <option value="">Position…</option>
        {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <button className="btn btn-primary btn-sm" onClick={() => { onAdd(pid, posId); setPid(''); setPosId('') }}>Add</button>
    </div>
  )
}
