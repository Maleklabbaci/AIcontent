-- AIcontent / DesignAIplatform
-- Run this migration in the Supabase SQL editor for project DesignAIplatform.
-- Anonymous Auth must be enabled so the browser can receive a user-scoped identity.

create table if not exists public.aura_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  format text not null,
  preview_text text not null default '',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists aura_sessions_user_updated_idx
  on public.aura_sessions (user_id, updated_at desc);

alter table public.aura_sessions enable row level security;

-- Idempotent policy creation for a safe re-run of this migration.
drop policy if exists "Users can read their own Aura sessions" on public.aura_sessions;
drop policy if exists "Users can create their own Aura sessions" on public.aura_sessions;
drop policy if exists "Users can update their own Aura sessions" on public.aura_sessions;
drop policy if exists "Users can delete their own Aura sessions" on public.aura_sessions;

create policy "Users can read their own Aura sessions"
  on public.aura_sessions for select
  using (auth.uid() = user_id);

create policy "Users can create their own Aura sessions"
  on public.aura_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own Aura sessions"
  on public.aura_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own Aura sessions"
  on public.aura_sessions for delete
  using (auth.uid() = user_id);

create or replace function public.set_aura_sessions_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists aura_sessions_updated_at on public.aura_sessions;
create trigger aura_sessions_updated_at
before update on public.aura_sessions
for each row execute function public.set_aura_sessions_updated_at();
