begin;
create table if not exists public.staff_notification_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default true,
 offers boolean not null default true,
 jobs boolean not null default true,
 schedule boolean not null default true,
 system boolean not null default true,
 updated_at timestamptz not null default now()
);
alter table public.staff_notification_preferences enable row level security;
drop policy if exists staff_notification_preferences_self on public.staff_notification_preferences;
create policy staff_notification_preferences_self on public.staff_notification_preferences for all to authenticated using (user_id=auth.uid() or public.is_admin_user(auth.uid())) with check (user_id=auth.uid() or public.is_admin_user(auth.uid()));
create or replace function public.get_my_staff_settings() returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('profile',jsonb_build_object('user_id',sp.user_id,'username',sp.username,'display_name',sp.display_name,'role',sp.role,'phone',sp.phone,'active',sp.active,'notes',sp.notes),'notifications',jsonb_build_object('enabled',coalesce(np.enabled,true),'offers',coalesce(np.offers,true),'jobs',coalesce(np.jobs,true),'schedule',coalesce(np.schedule,true),'system',coalesce(np.system,true)))
 from public.staff_profiles sp left join public.staff_notification_preferences np on np.user_id=sp.user_id where sp.user_id=auth.uid() limit 1;
$$;
grant execute on function public.get_my_staff_settings() to authenticated;
notify pgrst,'reload schema';
commit;
