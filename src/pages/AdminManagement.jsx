import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import PeopleManager from '../components/PeopleManager.jsx'
import { useBranding } from '../context/BrandingContext.jsx'
import { uploadFile } from '../lib/supabaseClient.js'

function BrandingCard() {
  const { logoUrl, appName, updateBranding } = useBranding()
  const [name, setName] = useState(appName || '')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  function handleFile(e) {
    const f = e.target.files?.[0]
    setFile(f || null)
    setPreview(f ? URL.createObjectURL(f) : '')
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setMessage(null)
    try {
      let logo_url = logoUrl
      if (file) {
        const uploaded = await uploadFile(file, 'branding')
        logo_url = uploaded.url
      }
      await updateBranding({ logoUrl: logo_url, appName: name })
      setFile(null); setPreview('')
      setMessage({ type: 'success', text: 'Branding updated — the new logo/icon will show up across the app.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card card-pad" style={{ marginBottom: 24, maxWidth: 480 }}>
      <h3 style={{ marginTop: 0 }}>App branding</h3>
      <p className="hint-text" style={{ marginBottom: 16 }}>Replace the sidebar logo and browser tab icon, and set the app's display name.</p>
      {message && (
        <div className={message.type === 'error' ? 'error-text' : 'error-text'} style={message.type === 'success' ? { background: 'var(--sage)', color: 'var(--sage-ink)' } : {}}>
          {message.text}
        </div>
      )}
      <form onSubmit={handleSave}>
        <div className="field">
          <label>App name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Roster" />
        </div>
        <div className="field">
          <label>Logo / icon image</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            {(preview || logoUrl) && (
              <img src={preview || logoUrl} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)' }} />
            )}
            <input type="file" accept="image/*" onChange={handleFile} />
          </div>
          <p className="hint-text">Square images work best — used as both the sidebar mark and the browser tab icon.</p>
        </div>
        <button className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Save branding'}</button>
      </form>
    </div>
  )
}

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
      <BrandingCard />
      <PeopleManager role="admin" title="Staff / Admin list" addLabel="Add Staff/Admin" />
    </div>
  )
}
