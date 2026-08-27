import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import DataTable from './DataTable.jsx'
import Modal from './Modal.jsx'

const empty = { id: null, full_name: '', nickname: '', date_of_birth: '', email: '', login_code: '' }

/*
 * Creating/deleting a person requires elevated privileges (Supabase Auth
 * admin API), so those two actions call the Cloudflare Worker's
 * /admin/users endpoint, which holds the Supabase SERVICE ROLE key as a
 * secret and never ships it to the browser. Editing profile fields the
 * volunteer already owns (name, nickname, DOB) goes straight to Supabase,
 * since RLS already allows admins to write any profile.
 */
export default function PeopleManager({ role, title, addLabel }) {
  const { session } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').eq('role', role).order('full_name')
    setRows(data || [])
    setLoading(false)
  }

  async function workerFetch(path, options) {
    const workerUrl = import.meta.env.VITE_UPLOAD_WORKER_URL
    const res = await fetch(`${workerUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...(options?.headers || {})
      }
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      if (editing.id) {
        const { error } = await supabase.from('profiles').update({
          full_name: editing.full_name, nickname: editing.nickname,
          date_of_birth: editing.date_of_birth || null, login_code: editing.login_code
        }).eq('id', editing.id)
        if (error) throw error
      } else {
        await workerFetch('/admin/users', {
          method: 'POST',
          body: JSON.stringify({ ...editing, role })
        })
      }
      setEditing(null); load()
    } catch (err) {
      setError(err.message)
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this person? This also removes their login.')) return
    try {
      await workerFetch(`/admin/users/${id}`, { method: 'DELETE' })
      load()
    } catch (err) { alert(err.message) }
  }

  async function handleResendInvite(row) {
    try {
      await workerFetch(`/admin/users/${row.id}/reset`, { method: 'POST' })
      alert(`Sent a new-account email + reset request to ${row.email}.`)
    } catch (err) { alert(err.message) }
  }

  return (
    <div>
      <DataTable
        title={title}
        emptyText={loading ? 'Loading…' : 'Nobody added yet.'}
        columns={[
          { key: 'full_name', label: 'Name' },
          { key: 'nickname', label: 'Nickname' },
          { key: 'login_code', label: 'Username' },
          { key: 'date_of_birth', label: 'Date of birth' },
          { key: 'email', label: 'Email' }
        ]}
        rows={rows}
        onAdd={() => setEditing({ ...empty })}
        addLabel={addLabel}
        renderActions={(r) => (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(r)} style={{ marginRight: 8 }}>Edit</button>
            <button className="btn btn-accent btn-sm" onClick={() => handleResendInvite(r)} style={{ marginRight: 8 }}>Reset email</button>
            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>Delete</button>
          </>
        )}
      />

      {editing && (
        <Modal title={editing.id ? `Edit ${role}` : addLabel} onClose={() => setEditing(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-primary" form="person-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </>}>
          {error && <div className="error-text">{error}</div>}
          <form id="person-form" onSubmit={handleSave}>
            <div className="field"><label>Name</label>
              <input value={editing.full_name} onChange={e => setEditing({ ...editing, full_name: e.target.value })} required /></div>
            <div className="field"><label>Nickname</label>
              <input value={editing.nickname} onChange={e => setEditing({ ...editing, nickname: e.target.value })} /></div>
            <div className="field"><label>Username</label>
              <input value={editing.login_code} onChange={e => setEditing({ ...editing, login_code: e.target.value.toLowerCase() })}
                autoCapitalize="none" autoCorrect="off" spellCheck={false} required disabled={!!editing.id} />
              <p className="hint-text">Always saved lower-case.</p></div>
            <div className="field"><label>Date of birth</label>
              <input type="date" value={editing.date_of_birth || ''} onChange={e => setEditing({ ...editing, date_of_birth: e.target.value })} /></div>
            <div className="field"><label>Email</label>
              <input type="email" value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} required disabled={!!editing.id} /></div>
            {!editing.id && <p className="hint-text">Saving sends a "set your PIN" email to this address (Supabase invite flow).</p>}
          </form>
        </Modal>
      )}
    </div>
  )
}
