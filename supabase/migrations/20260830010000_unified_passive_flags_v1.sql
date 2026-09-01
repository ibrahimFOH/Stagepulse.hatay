begin;
alter table public.customers add column if not exists active boolean not null default true;
alter table public.site_media add column if not exists active boolean not null default true;
create index if not exists customers_active_idx on public.customers(active);
create index if not exists site_media_active_idx on public.site_media(active);
commit;
