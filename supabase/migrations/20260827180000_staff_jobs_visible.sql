-- Personel portalı işleri göremiyordu çünkü:
-- 1) fetchJobs çoğu zaman my_jobs_staff okuyor
-- 2) my_jobs_staff sadece job_staff ataması olanları gösteriyordu
-- 3) Teklif kabulünde oluşan işlere personel atanmıyordu
-- 4) jobs tablosu RLS sadece is_admin() idi

-- Aktif personel tüm işleri okuyabilsin (küçük ekip modeli)
drop policy if exists jobs_staff_select on public.jobs;
create policy jobs_staff_select on public.jobs
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.staff_profiles sp
      where sp.user_id = auth.uid() and sp.active = true
    )
  );

-- job_equipment okuma (malzeme listesi)
drop policy if exists job_equipment_staff_select on public.job_equipment;
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='job_equipment') then
    execute $p$
      create policy job_equipment_staff_select on public.job_equipment
        for select to authenticated
        using (
          public.is_admin()
          or exists (
            select 1 from public.staff_profiles sp
            where sp.user_id = auth.uid() and sp.active = true
          )
        )
    $p$;
  end if;
exception when others then null;
end $$;

-- my_jobs_staff: atama zorunlu değil — aktif personele tüm işler
create or replace view public.my_jobs_staff as
select j.*
from public.jobs j
where exists (
  select 1 from public.staff_profiles sp
  where sp.user_id = auth.uid() and sp.active = true
);

grant select on public.my_jobs_staff to authenticated;

-- offers_staff yoksa personel teklif de göremez; güvenli görünüm
create or replace view public.offers_staff as
select
  t.id,
  t.quote_number,
  t.name,
  t.company,
  t.location,
  t.people,
  t.event_date,
  t.event_type,
  t.type,
  t.total as agreed_amount,
  t.currency,
  t.status,
  t.created_at
from public.teklifler t
where exists (
  select 1 from public.staff_profiles sp
  where sp.user_id = auth.uid() and sp.active = true
)
and t.status in ('accepted','sent','preparing','reviewing');

grant select on public.offers_staff to authenticated;

-- equipment_staff yoksa
create or replace view public.equipment_staff as
select e.id, e.category, e.brand, e.model, e.quantity, e.active, e.notes
from public.equipment e
where e.active = true
  and exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = auth.uid() and sp.active = true
  );

grant select on public.equipment_staff to authenticated;

notify pgrst, 'reload schema';
