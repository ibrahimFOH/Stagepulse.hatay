begin;

-- Stagepulse company hierarchy.
-- Owner/Patron is the only account allowed to change the organization tree.
-- Admin capabilities are assignable to lower administrative roles without
-- granting them the ability to elevate themselves or edit the hierarchy.

create table if not exists public.org_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  tier integer not null check (tier between 0 and 6),
  is_admin_role boolean not null default false,
  can_manage_children boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.org_roles(code,name,tier,is_admin_role,can_manage_children) values
('owner','Patron / Owner',0,true,true),
('super_admin','Süper Admin',1,true,true),
('upper_admin','Üst Admin',2,true,true),
('ceo','CEO',3,true,true),
('department_manager','Departman Yöneticisi',4,true,true),
('regional_manager','Bölge Sorumlusu',4,true,true),
('employee','Çalışan',6,false,false)
on conflict (code) do update set name=excluded.name,tier=excluded.tier,is_admin_role=excluded.is_admin_role,can_manage_children=excluded.can_manage_children,active=true;

create table if not exists public.org_departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  description text,
  manager_user_id uuid references auth.users(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.org_departments(code,name,description) values
('management','Yönetim','Şirket üst yönetimi'),
('it','IT','Bilgi teknolojileri ve sistemler'),
('marketing','Marketing','Pazarlama, marka ve içerik'),
('sales','Satış','Satış ve ticari operasyonlar'),
('finance','Finans','Finans ve muhasebe'),
('operations','Operasyon','Etkinlik ve saha operasyonları'),
('technical','Teknik','Ses, ışık, görüntü ve teknik prodüksiyon'),
('hr','İnsan Kaynakları','Personel ve insan kaynakları'),
('logistics','Lojistik','Araç, sevkiyat ve saha lojistiği')
on conflict (code) do update set description=excluded.description,active=true,updated_at=now();

create table if not exists public.org_regions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  manager_user_id uuid references auth.users(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.org_regions(code,name) values
('antalya','Antalya'),
('hatay','Hatay'),
('adana','Adana')
on conflict (code) do update set name=excluded.name,active=true,updated_at=now();

create table if not exists public.org_positions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.org_positions(code,name,description) values
('owner','Patron / Owner','Şirket sahibi ve en üst yönetici'),
('super_admin','Süper Admin','Owner tarafından yetkilendirilen üst sistem yöneticisi'),
('upper_admin','Üst Admin','Üst seviye şirket yönetimi'),
('ceo','CEO','İcra ve şirket yönetimi'),
('department_manager','Departman Yöneticisi','Kendi departmanını ve bağlı personeli yönetir'),
('regional_manager','Bölge Sorumlusu','Kendi bölgesini ve bağlı personeli yönetir'),
('employee','Çalışan','Kendisine verilen görev ve panel kapsamı')
on conflict (code) do update set description=excluded.description,active=true;

create table if not exists public.org_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role_id uuid not null references public.org_roles(id),
  position_id uuid references public.org_positions(id),
  department_id uuid references public.org_departments(id) on delete set null,
  region_id uuid references public.org_regions(id) on delete set null,
  manager_user_id uuid references auth.users(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (manager_user_id is null or manager_user_id <> user_id)
);
create index if not exists org_memberships_role_idx on public.org_memberships(role_id,active);
create index if not exists org_memberships_department_idx on public.org_memberships(department_id,active);
create index if not exists org_memberships_region_idx on public.org_memberships(region_id,active);
create index if not exists org_memberships_manager_idx on public.org_memberships(manager_user_id,active);

-- Existing active Admin account(s) become Owner so the current business owner
-- retains complete visibility and control without requiring a manual migration.
insert into public.org_memberships(user_id,role_id,position_id,active)
select ap.user_id,r.id,p.id,true
from public.admin_profiles ap
join public.org_roles r on r.code='owner'
join public.org_positions p on p.code='owner'
where ap.active=true
on conflict (user_id) do update set role_id=excluded.role_id,position_id=excluded.position_id,active=true,updated_at=now();

create or replace function public.is_org_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_memberships om
    join public.org_roles r on r.id=om.role_id
    where om.user_id=auth.uid()
      and om.active=true
      and r.code='owner'
  );
$$;

create or replace function public.org_role_tier_for(p_user_id uuid default auth.uid())
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select r.tier
    from public.org_memberships om
    join public.org_roles r on r.id=om.role_id
    where om.user_id=p_user_id and om.active=true
    limit 1
  ),99);
$$;

create or replace function public.can_manage_org_member(p_target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_org_owner()
    or exists (
      select 1
      from public.org_memberships me
      join public.org_roles mr on mr.id=me.role_id
      join public.org_memberships target on target.user_id=p_target_user_id and target.active=true
      join public.org_roles tr on tr.id=target.role_id
      where me.user_id=auth.uid()
        and me.active=true
        and mr.can_manage_children=true
        and tr.tier > mr.tier
        and (me.department_id is null or me.department_id=target.department_id)
        and (me.region_id is null or me.region_id=target.region_id)
    );
$$;

create table if not exists public.admin_capability_grants (
  user_id uuid not null references auth.users(id) on delete cascade,
  capability_key text not null references public.admin_capabilities(key) on delete cascade,
  enabled boolean not null default false,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,capability_key)
);
create index if not exists admin_capability_grants_user_idx on public.admin_capability_grants(user_id,enabled);

create or replace function public.admin_has_capability(p_capability_key text,p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_org_owner()
      and p_user_id=auth.uid()
    or exists (
      select 1
      from public.admin_capability_grants g
      join public.org_memberships om on om.user_id=g.user_id and om.active=true
      join public.org_roles r on r.id=om.role_id and r.is_admin_role=true
      join public.admin_capabilities c on c.key=g.capability_key and c.active=true
      where g.user_id=p_user_id
        and g.enabled=true
        and g.capability_key=p_capability_key
    );
$$;

-- Every non-owner administrative account can receive each capability as a
-- separate switch. New grants are disabled by default.
insert into public.admin_capability_grants(user_id,capability_key,enabled)
select om.user_id,ac.key,false
from public.org_memberships om
join public.org_roles r on r.id=om.role_id and r.is_admin_role=true and r.code <> 'owner'
cross join public.admin_capabilities ac
where om.active=true and ac.active=true
on conflict (user_id,capability_key) do nothing;

alter table public.org_roles enable row level security;
alter table public.org_departments enable row level security;
alter table public.org_regions enable row level security;
alter table public.org_positions enable row level security;
alter table public.org_memberships enable row level security;
alter table public.admin_capability_grants enable row level security;

drop policy if exists org_roles_read on public.org_roles;
create policy org_roles_read on public.org_roles for select to authenticated
using (private.is_admin() or public.is_org_owner());

drop policy if exists org_departments_read on public.org_departments;
create policy org_departments_read on public.org_departments for select to authenticated
using (private.is_admin() or public.is_org_owner());
drop policy if exists org_departments_owner_write on public.org_departments;
create policy org_departments_owner_write on public.org_departments for all to authenticated
using (public.is_org_owner()) with check (public.is_org_owner());

drop policy if exists org_regions_read on public.org_regions;
create policy org_regions_read on public.org_regions for select to authenticated
using (private.is_admin() or public.is_org_owner());
drop policy if exists org_regions_owner_write on public.org_regions;
create policy org_regions_owner_write on public.org_regions for all to authenticated
using (public.is_org_owner()) with check (public.is_org_owner());

drop policy if exists org_positions_read on public.org_positions;
create policy org_positions_read on public.org_positions for select to authenticated
using (private.is_admin() or public.is_org_owner());
drop policy if exists org_positions_owner_write on public.org_positions;
create policy org_positions_owner_write on public.org_positions for all to authenticated
using (public.is_org_owner()) with check (public.is_org_owner());

drop policy if exists org_memberships_owner_all on public.org_memberships;
create policy org_memberships_owner_all on public.org_memberships for all to authenticated
using (public.is_org_owner()) with check (public.is_org_owner());
drop policy if exists org_memberships_self_read on public.org_memberships;
create policy org_memberships_self_read on public.org_memberships for select to authenticated
using (user_id=auth.uid());

-- Capability switches are controlled only by Owner. Lower admins cannot grant
-- themselves or another user a capability above their own authority.
drop policy if exists admin_capability_grants_owner_all on public.admin_capability_grants;
create policy admin_capability_grants_owner_all on public.admin_capability_grants for all to authenticated
using (public.is_org_owner()) with check (public.is_org_owner());
drop policy if exists admin_capability_grants_self_read on public.admin_capability_grants;
create policy admin_capability_grants_self_read on public.admin_capability_grants for select to authenticated
using (user_id=auth.uid());

commit;
