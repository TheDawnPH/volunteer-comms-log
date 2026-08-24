-- ============================================================
-- ROSTER — Row Level Security
-- Run after schema.sql
-- ============================================================

alter table public.profiles           enable row level security;
alter table public.positions          enable row level security;
alter table public.announcements      enable row level security;
alter table public.schedules          enable row level security;
alter table public.schedule_volunteers enable row level security;
alter table public.comms_equipment    enable row level security;
alter table public.comms_logs         enable row level security;

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------- profiles ----------
create policy "profiles: self can read own row" on public.profiles
  for select using (id = auth.uid());
create policy "profiles: admins can read all" on public.profiles
  for select using (public.is_admin());
create policy "profiles: admins can insert" on public.profiles
  for insert with check (public.is_admin());
create policy "profiles: admins can update any, self can update own" on public.profiles
  for update using (public.is_admin() or id = auth.uid());
create policy "profiles: admins can delete" on public.profiles
  for delete using (public.is_admin());

-- ---------- positions ----------
create policy "positions: all authenticated can read" on public.positions
  for select using (auth.role() = 'authenticated');
create policy "positions: admins write" on public.positions
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- announcements ----------
create policy "announcements: all authenticated can read" on public.announcements
  for select using (auth.role() = 'authenticated');
create policy "announcements: admins write" on public.announcements
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- schedules ----------
create policy "schedules: all authenticated can read" on public.schedules
  for select using (auth.role() = 'authenticated');
create policy "schedules: admins write" on public.schedules
  for all using (public.is_admin()) with check (public.is_admin());

create policy "schedule_volunteers: all authenticated can read" on public.schedule_volunteers
  for select using (auth.role() = 'authenticated');
create policy "schedule_volunteers: admins write" on public.schedule_volunteers
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- comms equipment ----------
create policy "comms_equipment: all authenticated can read" on public.comms_equipment
  for select using (auth.role() = 'authenticated');
create policy "comms_equipment: admins write" on public.comms_equipment
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- comms logs ----------
-- Any signed-in volunteer can open/close their OWN log entries
-- (Comms Login/Logout flow); admins can read every entry for the
-- Volunteer Attendance report.
create policy "comms_logs: self can read own" on public.comms_logs
  for select using (profile_id = auth.uid());
create policy "comms_logs: admins can read all" on public.comms_logs
  for select using (public.is_admin());
create policy "comms_logs: self can insert own" on public.comms_logs
  for insert with check (profile_id = auth.uid());
create policy "comms_logs: self can update own open entries" on public.comms_logs
  for update using (profile_id = auth.uid() or public.is_admin());
