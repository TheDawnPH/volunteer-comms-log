-- ============================================================
-- ROSTER — Supabase schema
-- Run this once in the Supabase SQL editor (or via `supabase db push`)
-- Mirrors the entities in Volunteer_System.png:
--   profiles (volunteers, staff/admins), positions, announcements,
--   schedules (+ assigned volunteers), comms equipment, comms logs
--   (time in / time out / release / lock), attendance is derived
--   from comms_logs.
-- ============================================================

create extension if not exists "pgcrypto";

-- Pin the database session timezone to Asia/Manila (UTC+8, no DST).
-- `timestamptz` columns always store true UTC instants regardless of
-- this setting, but it keeps `now()` and any un-annotated display in
-- the SQL editor / logs consistent with the app's locked timezone.
-- (Run as the project owner; on some Supabase plans you may need to
-- set this per-role instead of per-database — see README.)
alter database postgres set timezone to 'Asia/Manila';

-- ---------- profiles ----------
-- One row per auth.users row. `login_code` is the badge number /
-- nickname volunteers type on the PIN login screen; the PIN itself
-- IS the Supabase Auth password, so no PIN is ever stored here.
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          text not null check (role in ('volunteer','admin')) default 'volunteer',
  login_code    text not null unique,
  full_name     text not null,
  nickname      text,
  date_of_birth date,
  email         text not null,
  created_at    timestamptz not null default now()
);

-- ---------- positions ----------
create table if not exists public.positions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now()
);

-- ---------- announcements ----------
create table if not exists public.announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  image_url    text,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);

-- ---------- schedules ----------
create table if not exists public.schedules (
  id            uuid primary key default gen_random_uuid(),
  event_name    text not null,
  start_time    timestamptz not null,
  end_time      timestamptz not null,
  call_time     timestamptz,
  image_url     text,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);

-- Upgrading an existing database that predates the image_url column:
alter table public.schedules add column if not exists image_url text;

-- volunteers assigned to a schedule, each with a position
create table if not exists public.schedule_volunteers (
  id            uuid primary key default gen_random_uuid(),
  schedule_id   uuid not null references public.schedules(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  position_id   uuid references public.positions(id),
  unique(schedule_id, profile_id)
);

-- ---------- comms equipment ----------
create table if not exists public.comms_equipment (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  qr_value      text not null unique,        -- value encoded in the printed QR code
  status        text not null check (status in ('available','in_use','locked')) default 'available',
  created_at    timestamptz not null default now()
);

-- ---------- comms logs ----------
-- One row is opened on "Time IN" (headset scanned + claimed) and closed
-- on "Time OUT" (headset released). `locked` mirrors "Lock Headset in
-- use entry" while a volunteer is actively signed on; volunteer
-- attendance is simply "distinct time-in rows per profile per day".
--
-- A row belongs to EITHER a registered profile OR a guest (someone not
-- in the system) — never both, never neither. Guest entries are only
-- ever created by an admin (guest_created_by), from the admin side of
-- Comms Equipment, since a guest has no login of their own.
create table if not exists public.comms_logs (
  id                uuid primary key default gen_random_uuid(),
  equipment_id      uuid not null references public.comms_equipment(id),
  profile_id        uuid references public.profiles(id),
  guest_name        text,
  guest_created_by  uuid references public.profiles(id),
  time_in           timestamptz not null default now(),
  time_out          timestamptz,
  status            text not null check (status in ('in','out')) default 'in',
  created_at        timestamptz not null default now(),
  constraint comms_logs_identity_xor check (
    (profile_id is not null and guest_name is null) or
    (profile_id is null and guest_name is not null)
  )
);

-- Upgrading an existing database that predates guest comms logins:
alter table public.comms_logs alter column profile_id drop not null;
alter table public.comms_logs add column if not exists guest_name text;
alter table public.comms_logs add column if not exists guest_created_by uuid references public.profiles(id);
alter table public.comms_logs drop constraint if exists comms_logs_identity_xor;
alter table public.comms_logs add constraint comms_logs_identity_xor check (
  (profile_id is not null and guest_name is null) or
  (profile_id is null and guest_name is not null)
);

-- ---------- app settings (branding) ----------
-- Single-row-per-key store for the app icon/logo and any other
-- admin-editable branding, so it can be replaced without a redeploy.
create table if not exists public.app_settings (
  key         text primary key,
  value       text,
  updated_at  timestamptz not null default now()
);
insert into public.app_settings (key, value) values ('logo_url', null), ('app_name', 'Roster')
  on conflict (key) do nothing;

-- ============================================================
-- resolve_login_code — turns a badge number / nickname into the
-- hidden email address Supabase Auth needs for signInWithPassword.
-- SECURITY DEFINER so anonymous visitors on the login screen can
-- call it without read access to auth.users or all of `profiles`.
-- ============================================================
create or replace function public.resolve_login_code(code text)
returns text
language sql
security definer
set search_path = public
as $$
  -- Usernames are always stored lower-case; normalize the lookup too
  -- so login is case-insensitive regardless of what the volunteer types.
  select email from public.profiles where login_code = lower(trim(code)) limit 1;
$$;

grant execute on function public.resolve_login_code(text) to anon, authenticated;

-- Usernames (login_code) are always stored lower-case. Enforce it at
-- the database level too, so it holds even for rows written outside
-- the app (SQL editor, migrations, etc).
create or replace function public.lowercase_login_code()
returns trigger
language plpgsql
as $$
begin
  new.login_code := lower(trim(new.login_code));
  return new;
end;
$$;

drop trigger if exists profiles_lowercase_login_code on public.profiles;
create trigger profiles_lowercase_login_code
  before insert or update on public.profiles
  for each row execute function public.lowercase_login_code();

-- Auto-create a profile row whenever a new auth user is created via
-- the admin "Add Volunteer" / "Add Staff/Admin" flow (see worker or
-- an Edge Function that calls auth.admin.createUser, then inserts here).
