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
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);

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
create table if not exists public.comms_logs (
  id            uuid primary key default gen_random_uuid(),
  equipment_id  uuid not null references public.comms_equipment(id),
  profile_id    uuid not null references public.profiles(id),
  time_in       timestamptz not null default now(),
  time_out      timestamptz,
  status        text not null check (status in ('in','out')) default 'in',
  created_at    timestamptz not null default now()
);

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
  select email from public.profiles where login_code = code limit 1;
$$;

grant execute on function public.resolve_login_code(text) to anon, authenticated;

-- Auto-create a profile row whenever a new auth user is created via
-- the admin "Add Volunteer" / "Add Staff/Admin" flow (see worker or
-- an Edge Function that calls auth.admin.createUser, then inserts here).
