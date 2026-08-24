import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn('Supabase env vars are missing. Copy .env.example to .env and fill in your project values.')
}

export const supabase = createClient(url, anonKey)

// Uploads go through the Cloudflare Worker (see /worker) which writes to R2
// and returns a public URL. We never expose R2 credentials to the browser.
export async function uploadFile(file, folder = 'misc') {
  const workerUrl = import.meta.env.VITE_UPLOAD_WORKER_URL
  const form = new FormData()
  form.append('file', file)
  form.append('folder', folder)

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token

  const res = await fetch(`${workerUrl}/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form
  })
  if (!res.ok) throw new Error('Upload failed: ' + (await res.text()))
  return res.json() // { url, key }
}
