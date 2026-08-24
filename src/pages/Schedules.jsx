import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import DataTable from '../components/DataTable.jsx'
import Modal from '../components/Modal.jsx'

const emptySchedule = { id: null, event_name: '', start_time: '', end_time: '', call_time: '' }

export default function Schedules() {
  const { isAdmin, profile } = useAuth()
  const [rows, setRows] = useState([])
  const [volunteers, setVolunteers] = useState([])
  const [positions, setPositions] = useState([])
  const [assignments, setAssignments] = useState({}) // schedule_id -> [{profile_id, position_id}]
  const [editing, setEditing] = useState(null)
  const [assigningFor, setAssigningFor] = useState(null)
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

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const payload = {
        event_name: editing.event_name,
        start_time: editing.start_time,
        end_time: editing.end_time,
        call_time: editing.call_time || null,
        created_by: profile.id
      }
      if (editing.id) {
        const { error } = await supabase.from('schedules').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('schedules').insert(payload)
        if (error) throw error
      }
      setEditing(null)
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

  return (
    <div>
      <h2>{isAdmin ? 'Schedules' : 'My Schedule'}</h2>
      <p style={{ marginBottom: 20 }}>Event name, call time, start/end, and who's assigned.</p>

      <DataTable
        title="Upcoming events"
        columns={[
          { key: 'event_name', label: 'Event' },
          { key: 'call_time', label: 'Call time', render: r => r.call_time ? new Date(r.call_time).toLocaleString() : '—' },
          { key: 'start_time', label: 'Start', render: r => new Date(r.start_time).toLocaleString() },
          { key: 'end_time', label: 'End', render: r => new Date(r.end_time).toLocaleString() },
          { key: 'crew', label: 'Crew', render: r => (assignments[r.id] || []).map(a => a.profiles?.nickname || a.profiles?.full_name).join(', ') || '—' }
        ]}
        rows={rows}
        onAdd={isAdmin ? () => setEditing({ ...emptySchedule }) : undefined}
        addLabel="Add Schedule"
        renderActions={isAdmin ? (r) => (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setAssigningFor(r)} style={{ marginRight: 8 }}>Crew</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(r)} style={{ marginRight: 8 }}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>Delete</button>
          </>
        ) : undefined}
      />

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
            <div className="field"><label>Call time</label>
              <input type="datetime-local" value={editing.call_time} onChange={e => setEditing({ ...editing, call_time: e.target.value })} /></div>
            <div className="field"><label>Start</label>
              <input type="datetime-local" value={editing.start_time} onChange={e => setEditing({ ...editing, start_time: e.target.value })} required /></div>
            <div className="field"><label>End</label>
              <input type="datetime-local" value={editing.end_time} onChange={e => setEditing({ ...editing, end_time: e.target.value })} required /></div>
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
