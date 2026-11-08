create or replace function public.sesm_review_full_package_purchase(p_purchase_id uuid, p_owner_user_id uuid, p_key_hash text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_request public.sesm_purchase_requests%rowtype;
  v_license public.sesm_license_keys%rowtype;
  v_core_id uuid;
begin
  if p_purchase_id is null or p_owner_user_id is null or p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='22023', message='PURCHASE_REVIEW_INPUT_INVALID';
  end if;

  if not exists (
    select 1
    from public.org_memberships m
    join public.org_roles r on r.id=m.role_id
    where m.user_id=p_owner_user_id
      and m.active is true
      and r.code='owner'
      and r.is_admin_role is true
      and r.active is true
  ) then
    raise exception using errcode='42501', message='PURCHASE_REVIEW_OWNER_REQUIRED';
  end if;

  select * into v_request from public.sesm_purchase_requests where id=p_purchase_id for update;
  if not found then raise exception using errcode='P0002', message='PURCHASE_NOT_FOUND'; end if;
  if v_request.status <> 'pending' then raise exception using errcode='P0001', message='PURCHASE_ALREADY_REVIEWED'; end if;

  insert into public.sesm_license_keys (
    key_hash,label,plan_code,bundle_code,max_activations,expires_at,created_by,notes,
    customer_name,customer_email,payment_method,payment_status,amount,currency,payment_reference
  ) values (
    p_key_hash,'FULL PAKET','student','full_master',3,null,p_owner_user_id,
    'Havale/EFT ile satın alındı; yönetici onaylı.',v_request.customer_name,
    v_request.customer_email,'bank_transfer','paid',v_request.amount,'TRY',v_request.transfer_reference
  ) returning * into v_license;

  insert into public.license_core (
    product_code,key_hash,key_normalization,legacy_system,legacy_license_id,owner_user_id,
    customer_name,status,plan_code,bundle_code,max_devices,expires_at,payment_status,metadata
  ) values (
    'ses-merkezi',p_key_hash,'alnum_upper','ses-merkezi',v_license.id,p_owner_user_id,
    v_request.customer_name,'active','full_package','full_master',3,null,'paid',
    jsonb_build_object('purchase_request_id',v_request.id,'payment_method','bank_transfer','amount',v_request.amount,'currency','TRY')
  ) returning id into v_core_id;

  update public.sesm_purchase_requests set status='approved',reviewed_by=p_owner_user_id,
    reviewed_at=pg_catalog.now(),license_id=v_license.id,updated_at=pg_catalog.now() where id=v_request.id;
  insert into public.sesm_audit_events(actor_user_id,action,subject_user_id,license_id,details)
  values (p_owner_user_id,'full_package_purchase_approved',v_request.user_id,v_license.id,
    jsonb_build_object('purchase_request_id',v_request.id,'amount',v_request.amount,'currency','TRY'));
  return jsonb_build_object('purchase_id',v_request.id,'license_id',v_license.id,'license_core_id',v_core_id);
end;
$function$;

revoke all on function public.sesm_review_full_package_purchase(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.sesm_review_full_package_purchase(uuid,uuid,text) to service_role;
