begin;

create or replace function public.owner_control_center()
returns jsonb language plpgsql stable security definer
set search_path='pg_catalog','public','private','auth','pg_temp'
as $function$
declare r jsonb;
begin
 if not private.is_org_owner() then return jsonb_build_object('authorized',false); end if;
 select jsonb_build_object(
  'authorized',true,'generated_at',now(),
  'metrics',jsonb_build_object('offers',(select count(*) from public.teklifler),'offers_open',(select count(*) from public.teklifler where lower(coalesce(status,'')) in ('new','reviewing','sent','pending','open')),'offers_accepted',(select count(*) from public.teklifler where lower(coalesce(status,''))='accepted'),'jobs',(select count(*) from public.jobs),'jobs_active',(select count(*) from public.jobs where lower(coalesce(status,'')) not in ('completed','cancelled','closed')),'equipment',(select count(*) from public.equipment where coalesce(active,true)=true),'equipment_low_stock',(select count(*) from public.equipment where coalesce(available_quantity,0)<=coalesce(quantity,0) and coalesce(active,true)=true),'payments_pending',(select coalesce(sum(amount),0) from public.payments where lower(coalesce(status,'')) in ('pending','partial')),'payments_overdue',(select coalesce(sum(amount),0) from public.payments where lower(coalesce(status,''))='overdue'),'unread_notifications',(select count(*) from public.notifications where read_at is null)),
  'admin_members',coalesce((select jsonb_agg(x order by x.email) from (
   select m.user_id::text user_id,u.email,r.code role_code,r.name role_name,r.tier role_tier,m.active,m.department_id,m.region_id,m.manager_user_id,d.code department_code,d.name department_name,rg.code region_code,rg.name region_name,pos.code position_code,pos.name position_name,
    case when r.code='owner' then 999999 else (select count(*) from public.admin_capabilities c where c.active=true and exists(select 1 from public.admin_capability_grants g where g.user_id=m.user_id and g.capability_key=c.key and g.enabled=true)) end enabled_capabilities,
    (select count(*) from public.admin_capabilities where active=true) total_capabilities
   from public.org_memberships m join auth.users u on u.id=m.user_id join public.org_roles r on r.id=m.role_id left join public.org_departments d on d.id=m.department_id left join public.org_regions rg on rg.id=m.region_id left join public.org_positions pos on pos.id=m.position_id where m.active=true and r.is_admin_role=true
  ) x),'[]'::jsonb),
  'capabilities',coalesce((select jsonb_agg(c order by c.category,c.name) from (select key,name,category,description from public.admin_capabilities where active=true) c),'[]'::jsonb),
  'grants',coalesce((select jsonb_agg(g) from (select user_id::text user_id,capability_key,enabled from public.admin_capability_grants where enabled=true) g),'[]'::jsonb),
  'recent_activity',coalesce((select jsonb_agg(a order by a.created_at desc) from (select action,entity_type,created_at,metadata from public.activity_logs order by created_at desc limit 30) a),'[]'::jsonb),
  'alerts',coalesce((select jsonb_agg(a order by a.priority desc,a.created_at desc) from (
   select 'payment_overdue' key,'Yüksek' priority,'Gecikmiş ödeme' title,'Tahsilat bekleyen gecikmiş ödemeler var.' detail,(select coalesce(sum(amount),0) from public.payments where lower(coalesce(status,''))='overdue') value,now() created_at where exists(select 1 from public.payments where lower(coalesce(status,''))='overdue' and coalesce(amount,0)>0)
   union all select 'low_stock','Orta','Düşük stok','Minimum stok seviyesinin altındaki ekipmanlar var.',(select count(*) from public.equipment where coalesce(available_quantity,0)<=coalesce(quantity,0) and coalesce(active,true)=true),now() where exists(select 1 from public.equipment where coalesce(available_quantity,0)<=coalesce(quantity,0) and coalesce(active,true)=true)
   union all select 'unread_notifications','Düşük','Okunmamış bildirim','Bekleyen sistem bildirimleri bulunuyor.',(select count(*) from public.notifications where read_at is null),now() where exists(select 1 from public.notifications where read_at is null)
  ) a),'[]'::jsonb)
 ) into r;
 return r;
end;
$function$;
revoke execute on function public.owner_control_center() from anon;
grant execute on function public.owner_control_center() to authenticated;

commit;
