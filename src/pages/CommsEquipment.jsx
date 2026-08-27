import React, { useEffect, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
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
  const qrCanvasRef = useRef(null)

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

  function downloadQr(equipment) {
    const canvas = qrCanvasRef.current?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    const safeName = (equipment.name || 'headset').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    link.download = `qr-${safeName}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div>
      <h2>Comms Equipment List</h2>
      <p style={{ marginBottom: 20 }}>Each headset gets a unique QR code volunteers scan (with their phone camera) to time in/out.</p>

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
              <input value={editing.qr_value} onChange={e => setEditing({ ...editing, qr_value: e.target.value })} placeholder="e.g. HEADSET-04" required />
              <p className="hint-text">Keep this short — it's what gets encoded into the QR code, and what a volunteer can type by hand if the camera scanner isn't available (the headset's name also works as a fallback).</p>
            </div>
          </form>
        </Modal>
      )}

      {showingQr && (
        <Modal title={`QR code — ${showingQr.name}`} onClose={() => setShowingQr(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setShowingQr(null)}>Close</button>
            <button className="btn btn-primary" onClick={() => downloadQr(showingQr)}>Download PNG</button>
          </>}>
          <div style={{ textAlign: 'center' }}>
            <div ref={qrCanvasRef} style={{ background: '#fff', display: 'inline-block', padding: 16, borderRadius: 12 }}>
              {/* size + margin tuned for reliable phone-camera scanning when printed */}
              <QRCodeCanvas value={showingQr.qr_value} size={240} level="M" includeMargin marginSize={2} />
            </div>
            <p className="hint-text" style={{ marginTop: 12 }}>Download and print — attach to the physical headset. Also scannable straight off this screen.</p>
          </div>
        </Modal>
      )}
    </div>
  )
}
