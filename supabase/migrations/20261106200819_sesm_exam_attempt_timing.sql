alter table public.sesm_exam_attempts
  add column if not exists started_at timestamptz not null default now(),
  add column if not exists status text not null default 'submitted'
    check (status in ('in_progress','submitted','timed_out'));
alter table public.sesm_exam_attempts alter column submitted_at drop not null;
