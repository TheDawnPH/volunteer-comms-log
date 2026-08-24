import React from 'react'
import { Link } from 'react-router-dom'
import PeopleManager from '../components/PeopleManager.jsx'

export default function AdminManagement() {
  return (
    <div>
      <h2>Administrator Management</h2>
      <p style={{ marginBottom: 20 }}>
        Staff &amp; admin accounts. See also{' '}
        <Link to="/comms-equipment" className="hint-text" style={{ textDecoration: 'underline' }}>Comms Equipment</Link>
        {' '}and{' '}
        <Link to="/attendance" className="hint-text" style={{ textDecoration: 'underline' }}>Volunteer Attendance</Link>.
      </p>
      <PeopleManager role="admin" title="Staff / Admin list" addLabel="Add Staff/Admin" />
    </div>
  )
}
