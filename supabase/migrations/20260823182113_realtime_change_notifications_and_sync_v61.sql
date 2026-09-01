do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='teklifler') then
    alter publication supabase_realtime add table public.teklifler;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='jobs') then
    alter publication supabase_realtime add table public.jobs;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

create or replace function public.notify_offer_change() returns trigger
language plpgsql security definer set search_path to '' as $$
declare u uuid := auth.uid(); meaningful boolean;
begin
  meaningful := (to_jsonb(new) - array['updated_at','event_date','evaluation_status','evaluated_by','evaluated_at','accepted_at','rejected_at','archived_at']) is distinct from (to_jsonb(old) - array['updated_at','event_date','evaluation_status','evaluated_by','evaluated_at','accepted_at','rejected_at','archived_at']);
  if not meaningful then return new; end if;
  insert into public.notifications(recipient_user_id,kind,title,body,offer_id)
  select r.user_id,'offer_change','Teklif güncellendi',coalesce(new.quote_number,'Teklif') || ' üzerinde değişiklik yapıldı.',new.id
  from (
    select ap.user_id from public.admin_profiles ap where ap.active=true and ap.user_id is distinct from u
    union
    select sp.user_id from public.staff_profiles sp join public.staff_permissions perm on perm.user_id=sp.user_id and perm.permission_key='offers.view' and perm.enabled=true where sp.active=true and sp.user_id is not null and sp.user_id is distinct from u
  ) r;
  return new;
exception when others then raise warning 'offer change notification failed: %', sqlerrm; return new;
end $$;

create or replace function public.notify_job_change() returns trigger
language plpgsql security definer set search_path to '' as $$
declare u uuid := auth.uid(); meaningful boolean;
begin
  meaningful := (to_jsonb(new) - array['updated_at','setup_at','event_at','teardown_at','event_start_at','event_end_at','setup_start_at','teardown_end_at']) is distinct from (to_jsonb(old) - array['updated_at','setup_at','event_at','teardown_at','event_start_at','event_end_at','setup_start_at','teardown_end_at']);
  if not meaningful then return new; end if;
  insert into public.notifications(recipient_user_id,kind,title,body,offer_id)
  select r.user_id,'job_change','İş güncellendi',coalesce(new.title,'İş') || ' üzerinde değişiklik yapıldı.',new.offer_id
  from (
    select ap.user_id from public.admin_profiles ap where ap.active=true and ap.user_id is distinct from u
    union
    select s.user_id from public.job_staff js join public.staff s on s.id=js.staff_id where js.job_id=new.id and s.active=true and s.user_id is not null and s.user_id is distinct from u
  ) r;
  return new;
exception when others then raise warning 'job change notification failed: %', sqlerrm; return new;
end $$;

drop trigger if exists trg_offer_change_notification on public.teklifler;
create trigger trg_offer_change_notification after update on public.teklifler for each row execute function public.notify_offer_change();
drop trigger if exists trg_job_change_notification on public.jobs;
create trigger trg_job_change_notification after update on public.jobs for each row execute function public.notify_job_change();
alter table public.teklifler replica identity full;
alter table public.jobs replica identity full;
alter table public.notifications replica identity full;
