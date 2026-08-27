import React, { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabaseClient.js'
import DataTable from '../components/DataTable.jsx'
import { formatManila } from '../lib/timezone.js'

export default function Attendance() {
  const [logs, setLogs] = useState([])
  const [volunteers, setVolunteers] = useState([])
  const [volunteerId, setVolunteerId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('id, full_name, nickname').eq('role', 'volunteer').order('full_name')
      .then(({ data }) => setVolunteers(data || []))
  }, [])

  useEffect(() => { load() }, [volunteerId, from, to])

  async function load() {
    let query = supabase
      .from('comms_logs')
      .select('*, profiles(full_name, nickname), comms_equipment(name)')
      .order('time_in', { ascending: false })

    if (volunteerId) query = query.eq('profile_id', volunteerId)
    if (from) query = query.gte('time_in', new Date(from).toISOString())
    if (to) query = query.lte('time_in', new Date(to + 'T23:59:59').toISOString())

    const { data } = await query
    setLogs(data || [])
  }

  function rowsForExport() {
    return logs.map(r => ({
      Volunteer: r.profiles?.nickname || r.profiles?.full_name || '—',
      Headset: r.comms_equipment?.name || '—',
      'Time IN': formatManila(r.time_in),
      'Time OUT': r.time_out ? formatManila(r.time_out) : '—',
      Status: r.status
    }))
  }

  function handlePrint() {
    window.print()
  }

  function handleExportExcel() {
    const sheet = XLSX.utils.json_to_sheet(rowsForExport())
    sheet['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 10 }]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Attendance')
    const stamp = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(workbook, `volunteer-attendance-${stamp}.xlsx`)
  }

  return (
    <div>
      <h2>Volunteer Attendance</h2>
      <p style={{ marginBottom: 20 }}>Attendance is derived from comms time-in/time-out logs, filterable below. Export or print reflects exactly what's filtered.</p>

      <div className="card card-pad" style={{ marginBottom: 20 }} data-print-hide>
        <div className="table-toolbar" style={{ marginBottom: 0 }}>
          <select value={volunteerId} onChange={e => setVolunteerId(e.target.value)} style={{ minWidth: 180 }}>
            <option value="">All volunteers</option>
            {volunteers.map(v => <option key={v.id} value={v.id}>{v.nickname || v.full_name}</option>)}
          </select>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          <button className="btn btn-secondary btn-sm" onClick={() => { setVolunteerId(''); setFrom(''); setTo('') }}>Clear filters</button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary btn-sm" onClick={handlePrint}>🖨️ Print</button>
          <button className="btn btn-primary btn-sm" onClick={handleExportExcel}>⬇️ Export to Excel</button>
        </div>
      </div>

      <div id="attendance-print-area">
        <DataTable
          title={`Log entries (${logs.length})`}
          columns={[
            { key: 'name', label: 'Volunteer', render: r => r.profiles?.nickname || r.profiles?.full_name },
            { key: 'headset', label: 'Headset', render: r => r.comms_equipment?.name },
            { key: 'time_in', label: 'Time IN', render: r => formatManila(r.time_in) },
            { key: 'time_out', label: 'Time OUT', render: r => r.time_out ? formatManila(r.time_out) : '—' },
            { key: 'status', label: 'Status', render: r => <span className={`tag ${r.status === 'in' ? 'tag-in' : 'tag-out'}`}>{r.status}</span> }
          ]}
          rows={logs}
          emptyText="No matching attendance records."
        />
      </div>
    </div>
  )
}
