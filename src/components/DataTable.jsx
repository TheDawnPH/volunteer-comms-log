import React from 'react'

/**
 * Generic CRUD table used across Announcements, Schedules, Volunteer
 * Management, Positions, Staff/Admin, and Comms Equipment screens —
 * every "List X" node in the flowchart shares this shape:
 * a toolbar (title + Add button) and rows with Edit/Delete actions.
 */
export default function DataTable({ title, columns, rows, onAdd, addLabel = 'Add', renderActions, onRowClick, emptyText = 'Nothing here yet.' }) {
  return (
    <div className="card card-pad">
      <div className="table-toolbar">
        <h3 style={{ margin: 0 }}>{title}</h3>
        {onAdd && <button className="btn btn-primary btn-sm" onClick={onAdd}>+ {addLabel}</button>}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(c => <th key={c.key}>{c.label}</th>)}
              {renderActions && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={columns.length + (renderActions ? 1 : 0)} style={{ color: 'var(--ink-faint)', textAlign: 'center', padding: '28px 0' }}>{emptyText}</td></tr>
            )}
            {rows.map((row, i) => (
              <tr
                key={row.id ?? i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {columns.map(c => <td key={c.key}>{c.render ? c.render(row) : row[c.key]}</td>)}
                {renderActions && (
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                    {renderActions(row)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
