-- Stagepulse Ses Merkezi eğitim yönetimi: sınavlar, soru bankası ve PDF kütüphanesi.
create table if not exists public.sesm_exams (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 180),
  description text not null default '' check (char_length(description) <= 3000),
  module_id text,
  duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 600),
  pass_percent numeric(5,2) not null default 70 check (pass_percent between 0 and 100),
  attempts_allowed integer not null default 1 check (attempts_allowed between 1 and 20),
  is_published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create table if not exists public.sesm_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.sesm_exams(id) on delete cascade,
  question_text text not null check (char_length(btrim(question_text)) between 2 and 4000),
  question_type text not null default 'single_choice' check (question_type in ('single_choice','multiple_choice','true_false','short_answer')),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  correct_answer jsonb not null,
  explanation text not null default '' check (char_length(explanation) <= 2000),
  points numeric(8,2) not null default 1 check (points > 0 and points <= 1000),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sesm_questions_exam_position_idx on public.sesm_questions(exam_id, position, created_at);
create table if not exists public.sesm_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.sesm_exams(id) on delete cascade,
  student_user_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  score numeric(10,2) not null default 0,
  max_score numeric(10,2) not null default 0,
  percent numeric(5,2) not null default 0 check (percent between 0 and 100),
  passed boolean not null default false,
  correct_count integer not null default 0,
  question_count integer not null default 0,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists sesm_exam_attempts_exam_date_idx on public.sesm_exam_attempts(exam_id, submitted_at desc);
create index if not exists sesm_exam_attempts_student_date_idx on public.sesm_exam_attempts(student_user_id, submitted_at desc);
create table if not exists public.sesm_education_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 180),
  description text not null default '' check (char_length(description) <= 3000),
  category text not null default 'genel' check (char_length(category) between 1 and 80),
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_size bigint not null default 0 check (file_size between 1 and 52428800),
  mime_type text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  version integer not null default 1 check (version > 0),
  is_published boolean not null default false,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists sesm_education_documents_published_idx on public.sesm_education_documents(is_published, category, updated_at desc);
create table if not exists public.sesm_document_events (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.sesm_education_documents(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('view','download')),
  platform text not null default 'unknown' check (platform in ('windows','android','web','unknown')),
  created_at timestamptz not null default now()
);
create index if not exists sesm_document_events_doc_date_idx on public.sesm_document_events(document_id, created_at desc);
create index if not exists sesm_document_events_user_idx on public.sesm_document_events(user_id, document_id);
alter table public.sesm_exams enable row level security;
alter table public.sesm_questions enable row level security;
alter table public.sesm_exam_attempts enable row level security;
alter table public.sesm_education_documents enable row level security;
alter table public.sesm_document_events enable row level security;
revoke all on public.sesm_exams, public.sesm_questions, public.sesm_exam_attempts, public.sesm_education_documents, public.sesm_document_events from anon, authenticated;
grant all on public.sesm_exams, public.sesm_questions, public.sesm_exam_attempts, public.sesm_education_documents, public.sesm_document_events to service_role;
grant usage, select on sequence public.sesm_document_events_id_seq to service_role;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('sesm-education-pdfs','sesm-education-pdfs',false,52428800,array['application/pdf'])
on conflict (id) do update set public=false,file_size_limit=52428800,allowed_mime_types=array['application/pdf'];
drop policy if exists sesm_education_pdf_admin_select on storage.objects;
drop policy if exists sesm_education_pdf_admin_insert on storage.objects;
drop policy if exists sesm_education_pdf_admin_update on storage.objects;
drop policy if exists sesm_education_pdf_admin_delete on storage.objects;
create policy sesm_education_pdf_admin_select on storage.objects for select to authenticated using (
 bucket_id='sesm-education-pdfs' and exists(select 1 from public.org_memberships m join public.org_roles r on r.id=m.role_id where m.user_id=(select auth.uid()) and m.active=true and r.code='owner' and r.is_admin_role=true and r.active=true)
);
create policy sesm_education_pdf_admin_insert on storage.objects for insert to authenticated with check (
 bucket_id='sesm-education-pdfs' and exists(select 1 from public.org_memberships m join public.org_roles r on r.id=m.role_id where m.user_id=(select auth.uid()) and m.active=true and r.code='owner' and r.is_admin_role=true and r.active=true)
);
create policy sesm_education_pdf_admin_update on storage.objects for update to authenticated using (
 bucket_id='sesm-education-pdfs' and exists(select 1 from public.org_memberships m join public.org_roles r on r.id=m.role_id where m.user_id=(select auth.uid()) and m.active=true and r.code='owner' and r.is_admin_role=true and r.active=true)
) with check (
 bucket_id='sesm-education-pdfs' and exists(select 1 from public.org_memberships m join public.org_roles r on r.id=m.role_id where m.user_id=(select auth.uid()) and m.active=true and r.code='owner' and r.is_admin_role=true and r.active=true)
);
create policy sesm_education_pdf_admin_delete on storage.objects for delete to authenticated using (
 bucket_id='sesm-education-pdfs' and exists(select 1 from public.org_memberships m join public.org_roles r on r.id=m.role_id where m.user_id=(select auth.uid()) and m.active=true and r.code='owner' and r.is_admin_role=true and r.active=true)
);
