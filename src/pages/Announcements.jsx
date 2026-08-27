import React, { useEffect, useState } from 'react'
import { supabase, uploadFile } from '../lib/supabaseClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import DataTable from '../components/DataTable.jsx'
import Modal from '../components/Modal.jsx'
import { formatManila } from '../lib/timezone.js'

const empty = { id: null, title: '', description: '', image_url: '' }

export default function Announcements() {
  const { isAdmin, profile } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      let image_url = editing.image_url
      if (file) {
        const uploaded = await uploadFile(file, 'announcements')
        image_url = uploaded.url
      }
      const payload = { title: editing.title, description: editing.description, image_url, created_by: profile.id }
      if (editing.id) {
        const { error } = await supabase.from('announcements').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('announcements').insert(payload)
        if (error) throw error
      }
      setEditing(null); setFile(null)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this announcement?')) return
    await supabase.from('announcements').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <h2>Announcements</h2>
      <p style={{ marginBottom: 20 }}>Posts from the organizing team, newest first. Click a row to open it.</p>

      <DataTable
        title="All announcements"
        emptyText={loading ? 'Loading…' : 'No announcements yet.'}
        columns={[
          { key: 'title', label: 'Title' },
          { key: 'description', label: 'Description', render: r => <span style={{ color: 'var(--ink-soft)' }}>{(r.description || '').slice(0, 80)}{(r.description || '').length > 80 ? '…' : ''}</span> },
          { key: 'image_url', label: 'Image', render: r => r.image_url ? <img src={r.image_url} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8 }} /> : '—' }
        ]}
        rows={rows}
        onAdd={isAdmin ? () => setEditing({ ...empty }) : undefined}
        addLabel="Add Announcement"
        onRowClick={(r) => setViewing(r)}
        renderActions={isAdmin ? (r) => (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(r)} style={{ marginRight: 8 }}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>Delete</button>
          </>
        ) : undefined}
      />

      {viewing && (
        <Modal title={viewing.title} onClose={() => setViewing(null)}
          footer={<button className="btn btn-secondary" onClick={() => setViewing(null)}>Close</button>}>
          {viewing.image_url && (
            <img src={viewing.image_url} alt="" style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 12, marginBottom: 16 }} />
          )}
          <p style={{ whiteSpace: 'pre-wrap', color: 'var(--ink)' }}>{viewing.description || 'No description provided.'}</p>
          <p className="hint-text" style={{ marginTop: 12 }}>Posted {formatManila(viewing.created_at)}</p>
        </Modal>
      )}

      {editing && (
        <Modal title={editing.id ? 'Edit announcement' : 'Add announcement'} onClose={() => setEditing(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-primary" form="ann-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </>}>
          {error && <div className="error-text">{error}</div>}
          <form id="ann-form" onSubmit={handleSave}>
            <div className="field">
              <label>Title</label>
              <input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} required />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea rows={4} value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} />
            </div>
            <div className="field">
              <label>Image</label>
              <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} />
              {editing.image_url && !file && <p className="hint-text">Current image will be kept unless you choose a new one.</p>}
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
