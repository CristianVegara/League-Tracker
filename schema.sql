-- ============================================================================
-- LIGA TRACKER — Supabase schema (Phase 1, security-hardened per OWASP Top 10)
-- Safe to run on a brand new project, and safe to re-run on top of the
-- earlier version of this file (every statement is idempotent).
--
-- Each policy below is commented with which OWASP Top 10 (2021) category it
-- addresses, so the reasoning stays visible instead of just the SQL.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PROFILES
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- COMPETITIONS
-- The "data" jsonb column holds players[]/matches[] — same shape the
-- original localStorage app used. What's new here is everything around it:
-- ownership, an audit timestamp, and a tight read boundary (see RLS below).
-- ----------------------------------------------------------------------------
create table if not exists public.competitions (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('league', 'tournament', 'season')),
  name text not null,
  status text not null default 'active' check (status in ('active', 'finished')),
  tags text[] not null default '{}',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.competitions add column if not exists updated_at timestamptz not null default now();

create index if not exists competitions_organizer_idx on public.competitions(organizer_id);
create index if not exists competitions_type_idx on public.competitions(type);
create index if not exists competitions_status_idx on public.competitions(status);
create index if not exists competitions_tags_idx on public.competitions using gin(tags);

-- OWASP A09 (Security Logging & Monitoring Failures): keep an honest
-- "last modified" timestamp instead of relying only on created_at.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists competitions_set_updated_at on public.competitions;
create trigger competitions_set_updated_at
  before update on public.competitions
  for each row execute procedure public.set_updated_at();

-- ----------------------------------------------------------------------------
-- MEMBERSHIP REQUESTS
-- ----------------------------------------------------------------------------
create table if not exists public.membership_requests (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (competition_id, user_id)
);

create index if not exists membership_requests_competition_idx on public.membership_requests(competition_id);
create index if not exists membership_requests_user_idx on public.membership_requests(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.competitions enable row level security;
alter table public.membership_requests enable row level security;

-- ---- profiles ----
-- Only id/display_name/created_at live here (no email, no auth data), so
-- broad read access is a deliberate low-risk choice — the app needs to show
-- names anywhere a player or organizer appears.
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  using (auth.role() = 'authenticated');

-- OWASP A01 (Broken Access Control): you can only ever edit your own row.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---- competitions ----
-- OWASP A01: this used to allow ANY signed-in user to read the full row of
-- every competition, including match data, for competitions they had no
-- relationship to. Fixed: full-row reads now require being the organizer or
-- an approved member. Lightweight discovery (browsing what exists, to
-- request joining) is handled separately via the safe view below, which
-- deliberately excludes the "data" column.
drop policy if exists "competitions_select_authenticated" on public.competitions;
drop policy if exists "competitions_select_owner_or_member" on public.competitions;
create policy "competitions_select_owner_or_member"
  on public.competitions for select
  using (
    auth.uid() = organizer_id
    or exists (
      select 1 from public.membership_requests mr
      where mr.competition_id = competitions.id
        and mr.user_id = auth.uid()
        and mr.status = 'approved'
    )
  );

-- OWASP A01 + A04 (Insecure Design): WITH CHECK is now explicit (not left to
-- Postgres's implicit fallback) on every write policy, so a malicious
-- payload can never smuggle in a different organizer_id and can never be
-- confirmed by a policy that only checked the row's state before the write.
drop policy if exists "competitions_insert_own" on public.competitions;
create policy "competitions_insert_own"
  on public.competitions for insert
  with check (auth.uid() = organizer_id);

drop policy if exists "competitions_update_own" on public.competitions;
create policy "competitions_update_own"
  on public.competitions for update
  using (auth.uid() = organizer_id)
  with check (auth.uid() = organizer_id);

drop policy if exists "competitions_delete_own" on public.competitions;
create policy "competitions_delete_own"
  on public.competitions for delete
  using (auth.uid() = organizer_id);

-- OWASP A01: discovery without over-exposure. This view runs with the
-- privileges of its owner (the role that ran this script), which bypasses
-- the restrictive SELECT policy above by design — that's what lets any
-- signed-in user browse *this specific, limited* set of columns. It never
-- selects "data", so match/player details still require organizer or
-- approved-member status via the table itself.
drop view if exists public.competition_listings;
create view public.competition_listings as
select
  id, type, name, status, tags, organizer_id, created_at, finished_at,
  coalesce(jsonb_array_length(data->'players'), 0) as player_count
from public.competitions;

grant select on public.competition_listings to authenticated;

-- ---- membership_requests ----
-- OWASP A01: you may only ever create a request for yourself, and it must
-- start "pending" — a client can't insert itself as pre-approved.
drop policy if exists "membership_requests_insert_own" on public.membership_requests;
create policy "membership_requests_insert_own"
  on public.membership_requests for insert
  with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "membership_requests_select_own" on public.membership_requests;
create policy "membership_requests_select_own"
  on public.membership_requests for select
  using (auth.uid() = user_id);

drop policy if exists "membership_requests_select_organizer" on public.membership_requests;
create policy "membership_requests_select_organizer"
  on public.membership_requests for select
  using (
    exists (
      select 1 from public.competitions c
      where c.id = competition_id and c.organizer_id = auth.uid()
    )
  );

drop policy if exists "membership_requests_update_organizer" on public.membership_requests;
create policy "membership_requests_update_organizer"
  on public.membership_requests for update
  using (
    exists (select 1 from public.competitions c where c.id = competition_id and c.organizer_id = auth.uid())
  )
  with check (
    exists (select 1 from public.competitions c where c.id = competition_id and c.organizer_id = auth.uid())
  );

-- Lets a user withdraw their own request (any status) — e.g. they change
-- their mind, or want to leave. Not required by OWASP, just reasonable.
drop policy if exists "membership_requests_delete_own" on public.membership_requests;
create policy "membership_requests_delete_own"
  on public.membership_requests for delete
  using (auth.uid() = user_id);

-- OWASP A01 (defense in depth): RLS controls *which rows*, this controls
-- *which columns* — even within a competition they organize, an organizer
-- can only ever change status/decided_at on a request, never re-point it at
-- a different user_id or competition_id.
revoke update on public.membership_requests from authenticated;
grant update (status, decided_at) on public.membership_requests to authenticated;

-- ============================================================================
-- Things this file cannot set for you — see SECURITY.md:
-- - Password minimum length / strength (Auth > Policies)
-- - Email confirmation requirement (Auth > Providers > Email)
-- - Auth rate limiting / CAPTCHA (Auth > Rate Limits)
-- - Session/refresh token lifetime (Auth > Sessions)
-- ============================================================================
