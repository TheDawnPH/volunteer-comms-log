import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import DataTable from '../components/DataTable.jsx'
import Modal from '../components/Modal.jsx'
import PeopleManager from '../components/PeopleManager.jsx'

export default function VolunteerManagement() {
  const [tab, setTab] = useState('volunteers')
  const [positions, setPositions] = useState([])
  const [editingPos, setEditingPos] = useState(null)
  const [saving, setSaving] = useState(false)

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
