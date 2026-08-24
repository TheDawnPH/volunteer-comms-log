# Roster — Volunteer Management System

A web app generated from `Volunteer_System.png`: PIN-based login for
volunteers and administrators, announcements, schedules, comms
headset login/logout (QR-based time in/out), volunteer & staff
management, positions, comms equipment, and attendance reporting.

- **Frontend:** React + Vite, pastel theme that adapts to the device's
  light/dark preference (with a manual override).
- **Hosting:** Cloudflare Pages (static frontend) + Cloudflare Worker
  (privileged API: file uploads, admin user management).
- **File storage:** Cloudflare R2 (announcement images, etc.), written
  to only through the Worker.
- **Auth / database:** Supabase (Postgres + Row Level Security +
  Supabase Auth, with a volunteer's "PIN" mapped to their Auth
  password — see `src/context/AuthContext.jsx` for the exact mapping).

```
volunteer-system/
├── src/                 # React app (pages, components, context)
├── supabase/
│   ├── schema.sql        # tables + resolve_login_code() RPC
│   └── policies.sql      # Row Level Security policies
├── worker/               # Cloudflare Worker (R2 + admin actions)
│   ├── src/index.js
│   └── wrangler.toml
├── .env.example
└── package.json
```

---

## 1. Prerequisites

- Node.js 18+ and npm
- A [Supabase](https://supabase.com) account (free tier is enough to start)
- A [Cloudflare](https://dash.cloudflare.com) account with Workers, R2,
  and Pages enabled
- The [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/): `npm install -g wrangler`

---

## 2. Set up Supabase

1. Create a new Supabase project. Note the **Project URL** and the
   **anon public key** (Project Settings → API) — you'll need both.
2. Open the SQL Editor and run, in order:
   - `supabase/schema.sql`
   - `supabase/policies.sql`
3. **Disable public sign-ups** (Authentication → Providers → Email →
   turn off "Allow new users to sign up"). Accounts are only ever
   created by an admin, through the Worker's admin endpoints.
4. **Create your first admin** so you have someone who can log in and
   add everyone else:
   - Authentication → Users → *Add user* → enter an email and a
     temporary password, and confirm the email.
   - In the SQL editor, insert their profile row:
     ```sql
     insert into public.profiles (id, role, login_code, full_name, email)
     values ('<paste-the-new-user-id>', 'admin', 'admin1', 'Your Name', 'you@example.com');
     ```
   - They can log in with badge number `admin1` and that temporary
     password as the PIN, then use *Forgot PIN* to set a real one.
5. Under Authentication → URL Configuration, add your deployed site's
   URL (and `http://localhost:5173` for local dev) to **Redirect URLs**
   so `/reset-pin` works after a password-reset email.

---

## 3. Set up Cloudflare R2 + the Worker

```bash
cd worker
npm install
npx wrangler login

# Create the bucket referenced in wrangler.toml
npx wrangler r2 bucket create volunteer-system-files

# Store secrets (never committed, never sent to the browser)
echo "<insert your supabase url>" | npx wrangler secret put SUPABASE_URL
echo "<insert your supabase anon key>" | npx wrangler secret put SUPABASE_ANON_KEY
echo "<insert your supabase service role key>" | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # Project Settings → API → service_role

# Deploy
npm run deploy
```

After deploying, Wrangler prints your Worker URL, e.g.
`https://volunteer-uploads.<your-subdomain>.workers.dev`. You'll put
this in the frontend's `.env` next.

**Optional — public file URLs:** by default the Worker streams files
back itself at `/file/<key>`. For a proper CDN URL, enable a public
bucket domain (R2 → your bucket → Settings → Public access, or attach
a custom domain), then set `R2_PUBLIC_BASE_URL` as a Worker variable
in `wrangler.toml` and redeploy.

---

## 4. Configure and run the frontend

```bash
cp .env.example .env
```

Fill in `.env`:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
VITE_UPLOAD_WORKER_URL=https://volunteer-uploads.YOUR-SUBDOMAIN.workers.dev
```

Then:

```bash
npm install
npm run dev       # http://localhost:5173
```

Log in with the admin badge number/PIN you created in step 2.4, then
use **Volunteer Management** and **Administrator Management → Staff/Admin
list** to add everyone else — creating a person there calls the Worker,
which creates their Supabase Auth login and emails them a link to set
their PIN.

---

## 5. Deploy the frontend to Cloudflare Pages

**Option A — Git integration (recommended)**
1. Push this repo to GitHub/GitLab.
2. Cloudflare dashboard → Workers & Pages → Create → Pages → connect
   the repo.
3. Build settings:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output directory: `dist`
4. Add the three `VITE_*` environment variables from `.env` under
   Pages → Settings → Environment variables (for both Production and
   Preview).
5. Deploy. Every push to your main branch redeploys automatically.

**Option B — Direct upload with Wrangler**
```bash
npm run build
wrangler pages deploy dist --project-name=volunteer-system
```

After your Pages site has a URL, go back to the Worker's CORS header
in `worker/src/index.js` (`Access-Control-Allow-Origin`) and set it to
that exact origin instead of `*`, then redeploy the Worker. Also add
the Pages URL to Supabase's Redirect URLs (step 2.5) if you haven't.

---

## 6. Feature map (flowchart → implementation)

| Flowchart node | Where it lives |
|---|---|
| Login / Forgot PIN / Reset PIN / Change PIN | `src/pages/Login.jsx`, `ForgotPin.jsx`, `ResetPin.jsx` |
| Volunteer & Administrator login using PIN | `AuthContext.loginWithPin` + `resolve_login_code()` RPC |
| Announcements (Add/List/Edit/Delete, Title/Description/Image) | `src/pages/Announcements.jsx`, images via Worker → R2 |
| Schedules (Add/List/Edit/Delete, event/time/crew/position) | `src/pages/Schedules.jsx` |
| Comms Login/Logout (scan, timed IN/OUT, lock/release headset) | `src/pages/CommsLogin.jsx` |
| Volunteer List / Positions List | `src/pages/VolunteerManagement.jsx`, `PeopleManager.jsx` |
| Staff/Admin List | `src/pages/AdminManagement.jsx` |
| Comms Equipment List + Generate QR Code | `src/pages/CommsEquipment.jsx` |
| Volunteer Attendance based on logs with filters | `src/pages/Attendance.jsx` |

---

## 7. Notes & next steps

- The comms QR "scan" field is a plain text input so it works without
  camera permissions. Swap in a camera-based scanner (e.g.
  `@yudiel/react-qr-scanner`) and feed its result into the same
  `handleScan` handler in `CommsLogin.jsx` for real QR scanning.
- The time-in/time-out check in `CommsLogin.jsx` does two sequential
  Supabase calls; for high-concurrency events, move that logic into a
  Postgres RPC (`SECURITY DEFINER`, single transaction) to fully
  prevent a race between two volunteers scanning the same headset at
  once.
- Theming: pastel tokens live in `src/styles/tokens.css`. The palette
  is identical in light/dark mode, just remapped onto darker/lighter
  surfaces, so accent colors always read as pastel.
