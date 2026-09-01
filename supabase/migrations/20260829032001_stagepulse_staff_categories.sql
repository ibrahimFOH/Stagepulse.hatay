-- Staff category layer: separates the person's primary operational category from individual skills.
create table if not exists public.staff_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_category_assignments (
  user_id uuid not null references public.staff_profiles(user_id) on delete cascade,
  category_id uuid not null references public.staff_categories(id) on delete cascade,
  primary_category boolean not null default false,
  level integer not null default 1 check (level between 1 and 5),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id,category_id)
);
create index if not exists staff_category_assignments_category_idx on public.staff_category_assignments(category_id,active);

insert into public.staff_categories(code,name,description,sort_order) values
('audio','Ses','FOH, monitör, sistem ve ses operasyonları',10),
('lighting','Işık','Sahne ışığı, DMX ve ışık operasyonu',20),
('video','Görüntü','LED, video playback ve görüntü operasyonu',30),
('stage','Sahne','Sahne, platform ve saha kurulumu',40),
('rigging','Rigging','Truss, kaldırma ve rigging koordinasyonu',50),
('production','Prodüksiyon','Saha liderliği ve teknik prodüksiyon yönetimi',60),
('warehouse','Depo','Depo, hazırlık, teslim ve iade operasyonları',70),
('logistics','Lojistik','Araç, sevkiyat ve saha lojistiği',80),
('driver','Sürücü','Araç ve personel taşıma operasyonu',90),
('technical','Teknik','Stage plot, rider, sistem planlama ve teknik ofis',100),
('maintenance','Bakım','Ekipman bakım, onarım ve servis',110),
('safety','İSG','Saha güvenliği ve güvenli çalışma koordinasyonu',120),
('management','Yönetim','Operasyon/yönetim sorumluluğu',130)
on conflict (code) do update set description=excluded.description,sort_order=excluded.sort_order,active=true;

alter table public.staff_categories enable row level security;
alter table public.staff_category_assignments enable row level security;

drop policy if exists staff_categories_authenticated on public.staff_categories;
create policy staff_categories_authenticated on public.staff_categories
  for select to authenticated using (public.is_active_staff() or private.is_admin());

drop policy if exists staff_category_assignments_self on public.staff_category_assignments;
create policy staff_category_assignments_self on public.staff_category_assignments
  for select to authenticated using (user_id = auth.uid() or private.is_admin());

drop policy if exists staff_category_assignments_admin on public.staff_category_assignments;
create policy staff_category_assignments_admin on public.staff_category_assignments
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
