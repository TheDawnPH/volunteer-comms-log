import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient.js'

const BrandingContext = createContext(null)

const DEFAULTS = { logoUrl: '', appName: 'Roster' }

export function BrandingProvider({ children }) {
  const [logoUrl, setLogoUrl] = useState(DEFAULTS.logoUrl)
  const [appName, setAppName] = useState(DEFAULTS.appName)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  useEffect(() => {
    // Swap the browser tab icon to the admin-uploaded logo, falling
    // back to nothing (browser default) if none is set.
    if (!logoUrl) return
    let link = document.querySelector("link[rel~='icon']")
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = logoUrl
    document.title = appName ? `${appName} · Volunteer Ops` : document.title
  }, [logoUrl, appName])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('app_settings').select('key, value').in('key', ['logo_url', 'app_name'])
    const map = Object.fromEntries((data || []).map(r => [r.key, r.value]))
    setLogoUrl(map.logo_url || DEFAULTS.logoUrl)
    setAppName(map.app_name || DEFAULTS.appName)
    setLoading(false)
  }

  async function updateBranding({ logoUrl: newLogoUrl, appName: newAppName }) {
    const updates = []
    if (newLogoUrl !== undefined) updates.push(supabase.from('app_settings').update({ value: newLogoUrl, updated_at: new Date().toISOString() }).eq('key', 'logo_url'))
    if (newAppName !== undefined) updates.push(supabase.from('app_settings').update({ value: newAppName, updated_at: new Date().toISOString() }).eq('key', 'app_name'))
    const results = await Promise.all(updates)
    const failed = results.find(r => r.error)
    if (failed) throw failed.error
    if (newLogoUrl !== undefined) setLogoUrl(newLogoUrl)
    if (newAppName !== undefined) setAppName(newAppName)
  }

  return (
    <BrandingContext.Provider value={{ logoUrl, appName, loading, updateBranding, refresh: load }}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding() {
  return useContext(BrandingContext)
}
