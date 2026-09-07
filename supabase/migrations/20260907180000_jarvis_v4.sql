-- Stagepulse Jarvis OS v4 security and state layer
create extension if not exists pgcrypto;

create table if not exists public.jarvis_approvals (
  id text primary key,
  type text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','executed','failed')),
  requested_by text not null,
  requested_by_user uuid references auth.users(id),
  preview jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  payload_hash text not null,
  decision_note text,
  decided_by uuid references auth.users(id),
  decision_at timestamptz,
  execution_result jsonb,
  executed_at timestamptz,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.jarvis_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid references auth.users(id),
  mode text not null,
  event_type text not null,
  body jsonb not null default '{}'::jsonb
);

create table if not exists public.jarvis_agents (
  id text primary key,
  name text not null,
  mode text not null default 'specialist',
  system_prompt text not null default '',
  tools text[] not null default '{}',
  status text not null default 'active' check (status in ('active','retired')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jarvis_memory (
  id bigint generated always as identity primary key,
  scope text not null,
  scope_id text not null,
  content jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists jarvis_approvals_status_idx on public.jarvis_approvals(status, created_at desc);
create index if not exists jarvis_audit_at_idx on public.jarvis_audit(at desc);

alter table public.jarvis_approvals enable row level security;
alter table public.jarvis_audit enable row level security;
alter table public.jarvis_agents enable row level security;
alter table public.jarvis_memory enable row level security;

create or replace function public.jarvis_is_patron()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select coalesce((auth.jwt()->'app_metadata'->>'role') in ('patron','owner'), false);
$$;
revoke all on function public.jarvis_is_patron() from public;
grant execute on function public.jarvis_is_patron() to authenticated;

drop policy if exists "jarvis approvals patron read" on public.jarvis_approvals;
create policy "jarvis approvals patron read" on public.jarvis_approvals for select to authenticated using (public.jarvis_is_patron());
drop policy if exists "jarvis audit patron read" on public.jarvis_audit;
create policy "jarvis audit patron read" on public.jarvis_audit for select to authenticated using (public.jarvis_is_patron());
drop policy if exists "jarvis agents patron all" on public.jarvis_agents;
create policy "jarvis agents patron all" on public.jarvis_agents for all to authenticated using (public.jarvis_is_patron()) with check (public.jarvis_is_patron());
drop policy if exists "jarvis memory patron all" on public.jarvis_memory;
create policy "jarvis memory patron all" on public.jarvis_memory for all to authenticated using (public.jarvis_is_patron()) with check (public.jarvis_is_patron());

revoke update, delete on public.jarvis_audit from anon, authenticated;
revoke update, delete on public.jarvis_approvals from anon;
revoke insert, update, delete on public.jarvis_approvals from anon, authenticated;
