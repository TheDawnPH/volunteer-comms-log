import React, { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabaseClient.js'
import DataTable from '../components/DataTable.jsx'
import Modal from '../components/Modal.jsx'
import PeopleManager from '../components/PeopleManager.jsx'

export default function VolunteerManagement() {
  const [tab, setTab] = useState('volunteers')
  const [positions, setPositions] = useState([])
  const [editingPos, setEditingPos] = useState(null)
  const [saving, setSaving] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [importMessage, setImportMessage] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => { if (tab === 'positions') loadPositions() }, [tab])

  async function loadPositions() {
    const { data } = await supabase.from('positions').select('*').order('name')
    setPositions(data || [])
  }

  async function savePosition(e) {
    e.preventDefault(); setSaving(true)
    try {
      if (editingPos.id) await supabase.from('positions').update({ name: editingPos.name }).eq('id', editingPos.id)
      else await supabase.from('positions').insert({ name: editingPos.name })
      setEditingPos(null); loadPositions()
    } finally { setSaving(false) }
  }

  async function deletePosition(id) {
    if (!confirm('Delete this position?')) return
    await supabase.from('positions').delete().eq('id', id)
    loadPositions()
  }

  // Excel import: expects a single-column list of position names, with
  // the first row being the "Positions List" header (skipped).
  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportBusy(true); setImportMessage(null)
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' })

      // Skip the first row — it's the "Positions List" header/title, not a position.
      const names = rows.slice(1)
        .map(row => (row?.[0] ?? '').toString().trim())
        .filter(Boolean)
      // De-dupe within the file itself, case-insensitively.
      const seen = new Set()
      const uniqueNames = names.filter(n => {
        const key = n.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key); return true
      })

      if (uniqueNames.length === 0) {
        setImportMessage({ type: 'error', text: 'No position names found under the header row.' })
        return
      }

      const { error } = await supabase
        .from('positions')
        .upsert(uniqueNames.map(name => ({ name })), { onConflict: 'name', ignoreDuplicates: true })
      if (error) throw error

      setImportMessage({ type: 'success', text: `Imported ${uniqueNames.length} position${uniqueNames.length === 1 ? '' : 's'} (existing ones were left as-is).` })
      loadPositions()
    } catch (err) {
      setImportMessage({ type: 'error', text: err.message || 'Could not read that file.' })
    } finally {
      setImportBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div>
      <h2>Volunteer Management</h2>
      <div className="theme-toggle" style={{ display: 'inline-flex', marginBottom: 20 }}>
        <button className={tab === 'volunteers' ? 'active' : ''} onClick={() => setTab('volunteers')}>Volunteer List</button>
        <button className={tab === 'positions' ? 'active' : ''} onClick={() => setTab('positions')}>Positions List</button>
      </div>

      {tab === 'volunteers' && <PeopleManager role="volunteer" title="Volunteers" addLabel="Add Volunteer" />}

      {tab === 'positions' && (
        <>
          <div className="card card-pad" style={{ marginBottom: 20 }}>
            <div className="table-toolbar" style={{ marginBottom: importMessage ? 12 : 0 }}>
              <div>
                <h3 style={{ margin: 0 }}>Import from Excel</h3>
                <p className="hint-text" style={{ margin: '4px 0 0' }}>One position name per row, first row is the "Positions List" header (it's skipped automatically).</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()} disabled={importBusy}>
                {importBusy ? 'Importing…' : '⬆️ Import .xlsx'}
              </button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImportFile} />
            </div>
            {importMessage && (
              <div className={importMessage.type === 'error' ? 'error-text' : 'error-text'} style={importMessage.type === 'success' ? { background: 'var(--sage)', color: 'var(--sage-ink)' } : {}}>
                {importMessage.text}
              </div>
            )}
          </div>

          <DataTable
            title="Positions"
            columns={[{ key: 'name', label: 'Position name' }]}
            rows={positions}
            onAdd={() => setEditingPos({ id: null, name: '' })}
            addLabel="Add Position"
            renderActions={(r) => (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditingPos(r)} style={{ marginRight: 8 }}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => deletePosition(r.id)}>Delete</button>
              </>
            )}
          />
          {editingPos && (
            <Modal title={editingPos.id ? 'Edit position' : 'Add position'} onClose={() => setEditingPos(null)}
              footer={<>
                <button className="btn btn-secondary" onClick={() => setEditingPos(null)}>Cancel</button>
                <button className="btn btn-primary" form="pos-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </>}>
              <form id="pos-form" onSubmit={savePosition}>
                <div className="field"><label>Position name</label>
                  <input value={editingPos.name} onChange={e => setEditingPos({ ...editingPos, name: e.target.value })} required autoFocus /></div>
              </form>
            </Modal>
          )}
        </>
      )}
    </div>
  )
}
