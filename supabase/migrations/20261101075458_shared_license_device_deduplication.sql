-- Tek fiziksel cihaz legacy adapter ve native app kimliğiyle iki kez sayılmasın.
create or replace function public.license_core_activate(
  p_license_id uuid,p_user_id uuid,p_app_id text,p_platform text,p_device_hash text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  lic public.license_core%rowtype;
  app public.license_products%rowtype;
  existing public.license_core_devices%rowtype;
  has_existing boolean := false;
  used_devices integer := 0;
begin
  if p_user_id is null or p_app_id is null or p_platform not in ('web','windows','android')
     or p_device_hash is null or length(p_device_hash)<8 or length(p_device_hash)>256 then
    raise exception 'LICENSE_ACTIVATION_INPUT_INVALID' using errcode='22023';
  end if;
  select * into app from public.license_products where app_id=p_app_id and is_active;
  if not found or app.platform<>p_platform then
    raise exception 'LICENSE_APP_NOT_ALLOWED' using errcode='42501';
  end if;
  select * into lic from public.license_core where id=p_license_id for update;
  if not found or lic.product_code<>app.product_code or lic.status<>'active'
     or lic.payment_status<>'paid' or (lic.expires_at is not null and lic.expires_at<=now()) then
    raise exception 'LICENSE_INVALID_OR_EXPIRED' using errcode='P0001';
  end if;
  select * into existing from public.license_core_devices
   where license_id=lic.id and device_hash=p_device_hash and is_active
   order by last_seen_at desc limit 1 for update;
  has_existing := found;
  if has_existing and existing.user_id is not null and existing.user_id<>p_user_id then
    raise exception 'DEVICE_BOUND_TO_OTHER_USER' using errcode='P0001';
  end if;
  select count(distinct device_hash)::integer into used_devices
   from public.license_core_devices where license_id=lic.id and is_active;
  if not has_existing and used_devices>=lic.max_devices then
    raise exception 'LICENSE_DEVICE_LIMIT' using errcode='P0001';
  end if;
  insert into public.license_core_devices(
    license_id,app_id,user_id,device_hash,platform,is_active,activated_at,last_seen_at
  ) values(lic.id,p_app_id,p_user_id,p_device_hash,p_platform,true,now(),now())
  on conflict(license_id,app_id,device_hash) do update set
    user_id=excluded.user_id,platform=excluded.platform,is_active=true,last_seen_at=now();
  insert into public.license_core_audit(license_id,actor_user_id,action,app_id,details)
  values(lic.id,p_user_id,'device_activated',p_app_id,
    jsonb_build_object('platform',p_platform,'device_hint',left(p_device_hash,8)));
  return jsonb_build_object('ok',true,'license_id',lic.id,'product_code',lic.product_code,
    'plan_code',lic.plan_code,'bundle_code',lic.bundle_code,'expires_at',lic.expires_at);
end;
$$;
revoke all on function public.license_core_activate(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.license_core_activate(uuid,uuid,text,text,text) to service_role;