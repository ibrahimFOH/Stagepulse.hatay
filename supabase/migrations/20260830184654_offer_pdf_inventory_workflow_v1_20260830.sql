begin;

create table if not exists public.offer_pdf_assets (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.teklifler(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null default 'application/pdf',
  size_bytes bigint not null default 0,
  sha256 text,
  is_current boolean not null default true,
  customer_visible boolean not null default true,
  version_no integer not null default 1,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists offer_pdf_assets_offer_idx on public.offer_pdf_assets(offer_id, created_at desc);
create unique index if not exists offer_pdf_assets_current_uq on public.offer_pdf_assets(offer_id) where is_current;

alter table public.teklifler add column if not exists pdf_storage_path text;
alter table public.teklifler add column if not exists pdf_file_name text;
alter table public.teklifler add column if not exists pdf_updated_at timestamptz;
alter table public.teklifler add column if not exists pdf_customer_visible boolean not null default true;

alter table public.offer_items add column if not exists source_type text not null default 'manual';
alter table public.offer_items add column if not exists inventory_reserved_qty numeric not null default 0;
alter table public.offer_items add column if not exists inventory_available_qty numeric not null default 0;

commit;
