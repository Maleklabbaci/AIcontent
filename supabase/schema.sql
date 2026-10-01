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

-- ============================================================
-- Platform data (profile, projects, templates, AI runs, billing)
-- Apply this file to the same Supabase project configured by the app.
-- The AI prompts themselves remain version-controlled in the worker; the
-- prompt-version tables below provide controlled version tracking/management.
-- ============================================================

-- Basic account data. Authentication credentials remain in auth.users.
create table if not exists public.aura_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  avatar_path text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- One row per user setting that should follow the account across devices.
create table if not exists public.aura_user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language text not null default 'fr' check (language in ('fr', 'en', 'ar')),
  active_model text not null default 'flash' check (active_model in ('flash', 'studio', 'pro')),
  use_templates boolean not null default true,
  active_project_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- A user's Brand Kits / workspaces. Text IDs preserve compatibility with the
-- current client IDs (for example "p1" and "project_...").
create table if not exists public.aura_projects (
  id text not null default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  handle text not null default '',
  accent_color text not null default '#F59E0B'
    check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  logo_path text,
  title_font text,
  body_font text,
  product_type text not null default '',
  visual_theme text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

create index if not exists aura_projects_user_updated_idx
  on public.aura_projects (user_id, updated_at desc);

-- Uploaded reference images are stored in the private `aura-assets` bucket;
-- SQL stores only their object path and metadata, never image base64.
create table if not exists public.aura_templates (
  id text not null default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text,
  name text not null default '',
  storage_path text not null,
  content_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id),
  unique (user_id, storage_path),
  constraint aura_templates_project_owner_fk
    foreign key (user_id, project_id)
    references public.aura_projects (user_id, id)
    on delete cascade
);

create index if not exists aura_templates_user_project_idx
  on public.aura_templates (user_id, project_id, created_at desc);

-- Sessions remain the user-facing conversation history. `messages` should
-- contain references to stored assets rather than large data URLs/base64 blobs.
alter table public.aura_sessions
  add column if not exists project_id text;

create index if not exists aura_sessions_user_project_updated_idx
  on public.aura_sessions (user_id, project_id, updated_at desc);

-- Prompt templates are managed by trusted server/admin tooling only. RLS is
-- enabled without client policies, so regular users cannot read or change them.
create table if not exists public.aura_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_key text not null,
  stage text not null check (stage in ('copy', 'image')),
  version text not null,
  template text not null,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (prompt_key, version)
);

create unique index if not exists aura_prompt_versions_one_active_idx
  on public.aura_prompt_versions (prompt_key)
  where is_active;

-- One row per AI call/stage (copy or image slide). Do not put uploaded or
-- generated image bytes in these JSON columns: use output_storage_path instead.
-- prompt_snapshot is optional because prompts can include private user content.
create table if not exists public.aura_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  generation_group_id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text references public.aura_sessions(id) on delete set null,
  project_id text,
  prompt_version_id uuid references public.aura_prompt_versions(id) on delete set null,
  prompt_version text not null default 'v1',
  stage text not null check (stage in ('copy', 'image')),
  slide_number integer check (slide_number is null or slide_number > 0),
  provider text not null default 'google',
  model_id text not null,
  format text,
  language text check (language is null or language in ('fr', 'en', 'ar')),
  style text check (style is null or style in ('dark', 'light')),
  user_prompt text not null default '',
  prompt_snapshot text,
  input_parameters jsonb not null default '{}'::jsonb,
  output_payload jsonb,
  output_storage_path text,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  error_code text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  points_charged integer not null default 0 check (points_charged >= 0),
  estimated_cost_usd numeric(12, 6) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  idempotency_key text,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  unique (user_id, idempotency_key)
);

create index if not exists aura_generation_jobs_user_created_idx
  on public.aura_generation_jobs (user_id, created_at desc);
create index if not exists aura_generation_jobs_group_idx
  on public.aura_generation_jobs (generation_group_id, created_at);
create index if not exists aura_generation_jobs_session_idx
  on public.aura_generation_jobs (session_id, created_at desc);

-- Optional explicit quality feedback for future prompt evaluation. This does
-- not train Gemini by itself; it only records feedback for a deliberate review.
create table if not exists public.aura_generation_feedback (
  id uuid primary key default gen_random_uuid(),
  generation_job_id uuid not null references public.aura_generation_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating in (-1, 1)),
  comment text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, generation_job_id)
);

-- Append-only points journal: positive amount = credit, negative = spend.
-- Writes are restricted to trusted backend/service-role code; users can read
-- only their own ledger. Never accept a client-side balance as authoritative.
create table if not exists public.aura_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount <> 0),
  entry_type text not null check (entry_type in (
    'welcome', 'purchase', 'generation_spend', 'refund', 'referral', 'adjustment', 'expiry'
  )),
  source text not null default '',
  reference_id text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, idempotency_key)
);

create index if not exists aura_credit_ledger_user_created_idx
  on public.aura_credit_ledger (user_id, created_at desc);

-- Subscription/payment records are server-owned. No card numbers or secrets
-- belong in these tables; payment-provider webhooks should be the source of truth.
create table if not exists public.aura_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_subscription_id text,
  plan_id text not null check (plan_id in ('free', 'starter', 'pro', 'business')),
  status text not null check (status in ('trialing', 'active', 'past_due', 'cancelled', 'expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (provider, provider_subscription_id)
);

create index if not exists aura_subscriptions_user_status_idx
  on public.aura_subscriptions (user_id, status);

create table if not exists public.aura_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_payment_id text,
  status text not null check (status in ('pending', 'succeeded', 'failed', 'refunded', 'cancelled')),
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  credits_purchased integer not null default 0 check (credits_purchased >= 0),
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (provider, provider_payment_id)
);

create index if not exists aura_payments_user_created_idx
  on public.aura_payments (user_id, created_at desc);

-- Referral codes and attribution. Code creation and reward issuance must happen
-- server-side after validating signup/payment; clients receive read-only access.
create table if not exists public.aura_referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9-]{4,32}$'),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.aura_referrals (
  id uuid primary key default gen_random_uuid(),
  referral_code_id uuid not null references public.aura_referral_codes(id) on delete restrict,
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  qualifying_payment_id uuid references public.aura_payments(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'qualified', 'rewarded', 'rejected')),
  referrer_reward integer not null default 0 check (referrer_reward >= 0),
  referred_reward integer not null default 0 check (referred_reward >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  qualified_at timestamptz,
  rewarded_at timestamptz,
  check (referrer_user_id <> referred_user_id)
);

create index if not exists aura_referrals_referrer_created_idx
  on public.aura_referrals (referrer_user_id, created_at desc);

-- Generic updated_at trigger for account/project tables.
create or replace function public.set_aura_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists aura_profiles_updated_at on public.aura_profiles;
create trigger aura_profiles_updated_at
before update on public.aura_profiles
for each row execute function public.set_aura_updated_at();

drop trigger if exists aura_projects_updated_at on public.aura_projects;
create trigger aura_projects_updated_at
before update on public.aura_projects
for each row execute function public.set_aura_updated_at();

drop trigger if exists aura_user_settings_updated_at on public.aura_user_settings;
create trigger aura_user_settings_updated_at
before update on public.aura_user_settings
for each row execute function public.set_aura_updated_at();

drop trigger if exists aura_subscriptions_updated_at on public.aura_subscriptions;
create trigger aura_subscriptions_updated_at
before update on public.aura_subscriptions
for each row execute function public.set_aura_updated_at();

-- RLS: all user-owned rows are isolated by auth.uid(). Server-owned financial
-- and prompt tables intentionally have no client write policy.
alter table public.aura_profiles enable row level security;
alter table public.aura_user_settings enable row level security;
alter table public.aura_projects enable row level security;
alter table public.aura_templates enable row level security;
alter table public.aura_prompt_versions enable row level security;
alter table public.aura_generation_jobs enable row level security;
alter table public.aura_generation_feedback enable row level security;
alter table public.aura_credit_ledger enable row level security;
alter table public.aura_subscriptions enable row level security;
alter table public.aura_payments enable row level security;
alter table public.aura_referral_codes enable row level security;
alter table public.aura_referrals enable row level security;

-- Profiles
drop policy if exists "Aura profile owner access" on public.aura_profiles;
create policy "Aura profile owner access"
  on public.aura_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Preferences
drop policy if exists "Aura settings owner access" on public.aura_user_settings;
create policy "Aura settings owner access"
  on public.aura_user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Projects / Brand Kits
drop policy if exists "Aura project owner access" on public.aura_projects;
create policy "Aura project owner access"
  on public.aura_projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Templates: only their owner can access metadata and object paths.
drop policy if exists "Aura template owner access" on public.aura_templates;
create policy "Aura template owner access"
  on public.aura_templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Prompt versions are intentionally server/service-role only: no user policies.
-- AI generation rows can be read by their owner; creation/update is server-only.
drop policy if exists "Aura generation owner read" on public.aura_generation_jobs;
create policy "Aura generation owner read"
  on public.aura_generation_jobs for select
  using (auth.uid() = user_id);

-- Users can read their own feedback and submit feedback only for their own run.
drop policy if exists "Aura generation feedback owner read" on public.aura_generation_feedback;
create policy "Aura generation feedback owner read"
  on public.aura_generation_feedback for select
  using (auth.uid() = user_id);

drop policy if exists "Aura generation feedback owner insert" on public.aura_generation_feedback;
create policy "Aura generation feedback owner insert"
  on public.aura_generation_feedback for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.aura_generation_jobs j
      where j.id = generation_job_id
        and j.user_id = auth.uid()
    )
  );

-- Users may inspect their own credit history, but cannot mint or alter credits.
drop policy if exists "Aura credit ledger owner read" on public.aura_credit_ledger;
create policy "Aura credit ledger owner read"
  on public.aura_credit_ledger for select
  using (auth.uid() = user_id);

-- Users can read their own subscription/payment/referral records only.
drop policy if exists "Aura subscription owner read" on public.aura_subscriptions;
create policy "Aura subscription owner read"
  on public.aura_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "Aura payment owner read" on public.aura_payments;
create policy "Aura payment owner read"
  on public.aura_payments for select
  using (auth.uid() = user_id);

drop policy if exists "Aura referral code owner read" on public.aura_referral_codes;
create policy "Aura referral code owner read"
  on public.aura_referral_codes for select
  using (auth.uid() = user_id);

drop policy if exists "Aura referral participants read" on public.aura_referrals;
create policy "Aura referral participants read"
  on public.aura_referrals for select
  using (auth.uid() = referrer_user_id or auth.uid() = referred_user_id);

-- Atomic credit journal entry. Only the Cloudflare/server backend may call this
-- with its service-role key; never expose that key to browser code.
create or replace function public.aura_apply_credit_entry(
  p_user_id uuid,
  p_amount integer,
  p_entry_type text,
  p_source text default '',
  p_reference_id text default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
  v_existing_amount integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;
  if p_user_id is null or p_amount is null or p_amount = 0 then
    raise exception 'invalid_credit_entry' using errcode = '22023';
  end if;
  if p_entry_type not in ('welcome', 'purchase', 'generation_spend', 'refund', 'referral', 'adjustment', 'expiry') then
    raise exception 'invalid_credit_entry_type' using errcode = '22023';
  end if;

  -- Serialize balance checks per user so concurrent generations cannot overspend.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  if p_idempotency_key is not null then
    select amount into v_existing_amount
    from public.aura_credit_ledger
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
    if found then
      if v_existing_amount <> p_amount then
        raise exception 'idempotency_key_reused' using errcode = '22023';
      end if;
      select coalesce(sum(amount), 0) into v_balance
      from public.aura_credit_ledger where user_id = p_user_id;
      return v_balance;
    end if;
  end if;

  select coalesce(sum(amount), 0) into v_balance
  from public.aura_credit_ledger where user_id = p_user_id;

  if p_amount < 0 and v_balance + p_amount < 0 then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;

  insert into public.aura_credit_ledger (
    user_id, amount, entry_type, source, reference_id, idempotency_key, metadata
  ) values (
    p_user_id, p_amount, p_entry_type, coalesce(p_source, ''), p_reference_id,
    p_idempotency_key, coalesce(p_metadata, '{}'::jsonb)
  );

  return v_balance + p_amount;
end;
$$;

revoke all on function public.aura_apply_credit_entry(uuid, integer, text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.aura_apply_credit_entry(uuid, integer, text, text, text, text, jsonb)
  to service_role;

-- Private Storage bucket for logos, reference images and generated images.
-- Object paths must start with the authenticated user's UUID:
-- <user-uuid>/<project-id>/<filename>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'aura-assets',
  'aura-assets',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Aura assets owner read" on storage.objects;
create policy "Aura assets owner read"
  on storage.objects for select
  using (
    bucket_id = 'aura-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Aura assets owner upload" on storage.objects;
create policy "Aura assets owner upload"
  on storage.objects for insert
  with check (
    bucket_id = 'aura-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Aura assets owner update" on storage.objects;
create policy "Aura assets owner update"
  on storage.objects for update
  using (
    bucket_id = 'aura-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'aura-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Aura assets owner delete" on storage.objects;
create policy "Aura assets owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'aura-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
