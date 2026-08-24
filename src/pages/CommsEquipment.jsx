import React, { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabaseClient.js'
import DataTable from '../components/DataTable.jsx'
import Modal from '../components/Modal.jsx'

const empty = { id: null, name: '', qr_value: '' }

export default function CommsEquipment() {
  const [rows, setRows] = useState([])
  const [editing, setEditing] = useState(null)
  const [showingQr, setShowingQr] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('comms_equipment').select('*').order('name')
    setRows(data || [])
  }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      if (editing.id) {
        const { error } = await supabase.from('comms_equipment').update({ name: editing.name, qr_value: editing.qr_value }).eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('comms_equipment').insert({ name: editing.name, qr_value: editing.qr_value })
        if (error) throw error
      }
      setEditing(null); load()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this comms equipment?')) return
    await supabase.from('comms_equipment').delete().eq('id', id)
    load()
  }

  return (
    <div>
      <h2>Comms Equipment List</h2>
      <p style={{ marginBottom: 20 }}>Each headset gets a unique QR code volunteers scan to time in/out.</p>

      <DataTable
        title="Headsets"
        columns={[
          { key: 'name', label: 'Equipment name' },
          { key: 'qr_value', label: 'QR value', render: r => <code style={{ fontFamily: 'var(--font-mono)' }}>{r.qr_value}</code> },
          { key: 'status', label: 'Status', render: r => <span className={`tag ${r.status === 'available' ? 'tag-in' : r.status === 'locked' ? 'tag-locked' : 'tag-out'}`}>{r.status}</span> }
        ]}
        rows={rows}
        onAdd={() => setEditing({ ...empty })}
        addLabel="Add Comms Equipment"
        renderActions={(r) => (
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowingQr(r)} style={{ marginRight: 8 }}>QR Code</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(r)} style={{ marginRight: 8 }}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>Delete</button>
          </>
        )}
      />

      {editing && (
        <Modal title={editing.id ? 'Edit comms equipment' : 'Add comms equipment'} onClose={() => setEditing(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-primary" form="eq-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </>}>
          {error && <div className="error-text">{error}</div>}
          <form id="eq-form" onSubmit={handleSave}>
            <div className="field"><label>Equipment name</label>
              <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} required /></div>
            <div className="field"><label>QR code value</label>
              <input value={editing.qr_value} onChange={e => setEditing({ ...editing, qr_value: e.target.value })} placeholder="e.g. HEADSET-04" required /></div>
          </form>
        </Modal>
      )}

      {showingQr && (
        <Modal title={`QR code — ${showingQr.name}`} onClose={() => setShowingQr(null)}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ background: '#fff', display: 'inline-block', padding: 16, borderRadius: 12 }}>
              <QRCodeSVG value={showingQr.qr_value} size={200} />
            </div>
            <p className="hint-text" style={{ marginTop: 12 }}>Print and attach to the physical headset.</p>
          </div>
        </Modal>
      )}
    </div>
  )
}
