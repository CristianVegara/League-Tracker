-- ============================================================================
-- LIGA TRACKER — Supabase schema (Phase 1)
-- Run this once in your Supabase project's SQL Editor (Database > SQL Editor).
-- Safe to re-run from scratch on a brand new project.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PROFILES
-- One row per user, extending Supabase's built-in auth.users.
-- We can't read auth.users directly from the client, so we mirror the bits
-- the app needs (display name) into a public table.
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever someone signs up.
create function public.handle_new_user()
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- COMPETITIONS
-- One row per league / tournament / season. The "data" column holds the same
-- JSON shape the original app already used (players[], matches[], swiss
-- state, playoffs bracket, etc.) — the fixture-generation, Swiss pairing, and
-- standings functions barely change, they just read/write this column
-- instead of localStorage.
-- ----------------------------------------------------------------------------
create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('league', 'tournament', 'season')),
  name text not null,
  status text not null default 'active' check (status in ('active', 'finished')),
  tags text[] not null default '{}',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index competitions_organizer_idx on public.competitions(organizer_id);
create index competitions_type_idx on public.competitions(type);
create index competitions_status_idx on public.competitions(status);
create index competitions_tags_idx on public.competitions using gin(tags);

-- ----------------------------------------------------------------------------
-- MEMBERSHIP REQUESTS
-- A registered user asking to join a competition. The organizer approves or
-- rejects it. Guest players (added by name, no account) never touch this
-- table — they just live inside competitions.data.players like today.
-- ----------------------------------------------------------------------------
create table public.membership_requests (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (competition_id, user_id)
);

create index membership_requests_competition_idx on public.membership_requests(competition_id);
create index membership_requests_user_idx on public.membership_requests(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- This is what actually enforces permissions server-side — without it,
-- anyone with the anon key could read/write any row.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.competitions enable row level security;
alter table public.membership_requests enable row level security;

-- ---- profiles ----
-- Any signed-in user can see display names (needed to show organizer/player
-- names anywhere in the UI). Only you can edit your own profile.
create policy "profiles_select_authenticated"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- ---- competitions ----
-- Any signed-in user can browse/read competitions (needed so people can
-- discover open leagues/tournaments to request joining). Only the organizer
-- can create, edit, or delete their own.
create policy "competitions_select_authenticated"
  on public.competitions for select
  using (auth.role() = 'authenticated');

create policy "competitions_insert_own"
  on public.competitions for insert
  with check (auth.uid() = organizer_id);

create policy "competitions_update_own"
  on public.competitions for update
  using (auth.uid() = organizer_id);

create policy "competitions_delete_own"
  on public.competitions for delete
  using (auth.uid() = organizer_id);

-- ---- membership_requests ----
-- A user can request to join (insert their own request) and see their own
-- requests. An organizer can see and decide on requests for competitions
-- they own.
create policy "membership_requests_insert_own"
  on public.membership_requests for insert
  with check (auth.uid() = user_id);

create policy "membership_requests_select_own"
  on public.membership_requests for select
  using (auth.uid() = user_id);

create policy "membership_requests_select_organizer"
  on public.membership_requests for select
  using (
    exists (
      select 1 from public.competitions c
      where c.id = competition_id and c.organizer_id = auth.uid()
    )
  );

create policy "membership_requests_update_organizer"
  on public.membership_requests for update
  using (
    exists (
      select 1 from public.competitions c
      where c.id = competition_id and c.organizer_id = auth.uid()
    )
  );

-- ============================================================================
-- Done. Next steps (see README.md):
-- 1. Project Settings > API — copy your Project URL and anon public key
--    into the CONFIG section at the top of index.html.
-- 2. Project Settings > Authentication — email/password is enabled by
--    default; you may want to disable "Confirm email" while testing locally.
-- ============================================================================
