/**
 * ROSTER — Cloudflare Worker
 * ---------------------------------------------------------------
 * Two jobs, both kept OUT of the browser bundle for security:
 *
 *  1. File uploads -> Cloudflare R2 (announcement images, etc.)
 *     POST /upload            (multipart/form-data: file, folder)
 *     GET  /file/:key         (serves the object back out, if you
 *                              don't set up a public R2 bucket URL)
 *
 *  2. Admin-only Supabase Auth actions, using the SERVICE ROLE key
 *     which must never reach the client:
 *     POST   /admin/users            create a volunteer/admin
 *     DELETE /admin/users/:id        remove a volunteer/admin
 *     POST   /admin/users/:id/reset  resend invite / reset-PIN email
 *
 * Required secrets (set with `wrangler secret put <NAME>`):
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 * Required binding (see wrangler.toml): R2 bucket as `BUCKET`.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // tighten to your Pages domain in production
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    try {
      if (url.pathname === '/upload' && request.method === 'POST') {
        return await handleUpload(request, env)
      }
      if (url.pathname.startsWith('/file/') && request.method === 'GET') {
        return await handleServeFile(url, env)
      }
      if (url.pathname === '/admin/users' && request.method === 'POST') {
        return await handleCreateUser(request, env)
      }
      if (url.pathname.match(/^\/admin\/users\/[^/]+$/) && request.method === 'DELETE') {
        const id = url.pathname.split('/').pop()
        return await handleDeleteUser(request, env, id)
      }
      if (url.pathname.match(/^\/admin\/users\/[^/]+\/reset$/) && request.method === 'POST') {
        const id = url.pathname.split('/')[3]
        return await handleResetUser(request, env, id)
      }
      return json({ error: 'Not found' }, 404)
    } catch (err) {
      return json({ error: err.message || 'Server error' }, 500)
    }
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  })
}

// ---------------------------------------------------------------
// Auth helpers — verify the caller's Supabase session, then check
// their `profiles.role` to make sure only admins hit /admin/*.
// ---------------------------------------------------------------
async function getCallerProfile(request, env) {
  const authHeader = request.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) throw new Error('Missing Authorization header')

  const userRes = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: env.SUPABASE_ANON_KEY }
  })
  if (!userRes.ok) throw new Error('Invalid or expired session')
  const user = await userRes.json()

  const profileRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=*`,
    { headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY } }
  )
  const profiles = await profileRes.json()
  if (!profiles?.[0]) throw new Error('No profile for this user')
  return profiles[0]
}

async function requireAdmin(request, env) {
  const profile = await getCallerProfile(request, env)
  if (profile.role !== 'admin') throw new Error('Admin access required')
  return profile
}

// ---------------------------------------------------------------
// R2 uploads
// ---------------------------------------------------------------
async function handleUpload(request, env) {
  await getCallerProfile(request, env) // any signed-in user may upload
  const form = await request.formData()
  const file = form.get('file')
  const folder = (form.get('folder') || 'misc').toString().replace(/[^a-z0-9-_]/gi, '')
  if (!file) return json({ error: 'No file provided' }, 400)

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const key = `${folder}/${crypto.randomUUID()}.${ext}`

  await env.BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' }
  })

  // If your R2 bucket has a public URL / custom domain configured, prefer
  // that here instead of the worker's own /file/ passthrough route:
  const publicBase = env.R2_PUBLIC_BASE_URL // e.g. https://cdn.yourdomain.com
  const url = publicBase ? `${publicBase}/${key}` : `${new URL(request.url).origin}/file/${key}`

  return json({ url, key })
}

async function handleServeFile(url, env) {
  const key = decodeURIComponent(url.pathname.replace('/file/', ''))
  const obj = await env.BUCKET.get(key)
  if (!obj) return new Response('Not found', { status: 404 })
  return new Response(obj.body, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  })
}

// ---------------------------------------------------------------
// Admin user management (create / delete / resend invite)
// ---------------------------------------------------------------
async function handleCreateUser(request, env) {
  await requireAdmin(request, env)
  const body = await request.json()
  const { full_name, nickname, date_of_birth, email, login_code, role } = body
  if (!full_name || !email || !login_code || !role) return json({ error: 'Missing required fields' }, 400)

  // 1. Create the Supabase Auth user with a random temporary password —
  //    the invite email lets them set their real PIN.
  const tempPassword = crypto.randomUUID()
  const createRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password: tempPassword, email_confirm: true })
  })
  const authUser = await createRes.json()
  if (!createRes.ok) return json({ error: authUser.msg || 'Could not create login' }, 400)

  // 2. Insert the profile row.
  const profileRes = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({ id: authUser.id, role, full_name, nickname, date_of_birth: date_of_birth || null, email, login_code })
  })
  if (!profileRes.ok) return json({ error: 'Could not save profile' }, 400)

  // 3. Send a "set your PIN" reset-password email so they never see the temp password.
  await fetch(`${env.SUPABASE_URL}/auth/v1/recover`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })

  return json({ ok: true, id: authUser.id })
}

async function handleDeleteUser(request, env, id) {
  await requireAdmin(request, env)
  await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY }
  })
  await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY }
  })
  return json({ ok: true })
}

async function handleResetUser(request, env, id) {
  await requireAdmin(request, env)
  const profileRes = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${id}&select=email`, {
    headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY }
  })
  const [row] = await profileRes.json()
  if (!row) return json({ error: 'Profile not found' }, 404)

  await fetch(`${env.SUPABASE_URL}/auth/v1/recover`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: row.email })
  })
  return json({ ok: true })
}
