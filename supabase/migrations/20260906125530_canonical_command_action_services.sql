begin;

create or replace function public.stagepulse_command_action(p_action text,p_entity text,p_id uuid default null,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer
set search_path='pg_catalog','public','private','auth','pg_temp'
as $function$
declare v_user uuid:=auth.uid(); v_table text; v_perm text; v_result jsonb; v_set text; v_where text; v_payload jsonb:=coalesce(p_payload,'{}'::jsonb);
begin
 if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
 if not private.is_org_owner() then
  v_perm:=case p_action when 'create' then p_entity||'.create' when 'update' then p_entity||'.update' when 'delete' then p_entity||'.delete' when 'approve' then case when p_entity='offers' then 'offers.manage' else 'approvals.manage' end when 'link' then 'resources.manage' else p_entity||'.manage' end;
  if not private.staff_has_exact_perm(v_perm) and not private.staff_has_exact_perm(p_entity||'.manage') then raise exception 'PERMISSION_DENIED'; end if;
 end if;
 if p_action='link' then
  case p_entity
   when 'job_staff' then insert into public.job_staff(job_id,staff_id,fee) values((v_payload->>'job_id')::uuid,(v_payload->>'staff_id')::uuid,coalesce((v_payload->>'fee')::numeric,0)) returning to_jsonb(job_staff) into v_result;
   when 'job_equipment' then insert into public.job_equipment(job_id,equipment_id,quantity,notes) values((v_payload->>'job_id')::uuid,(v_payload->>'equipment_id')::uuid,coalesce((v_payload->>'quantity')::int,1),v_payload->>'notes') returning to_jsonb(job_equipment) into v_result;
   when 'event_resource' then insert into public.event_resources(event_id,resource_type,staff_user_id,equipment_id,vehicle_id,quantity,required,status,notes) values((v_payload->>'event_id')::uuid,v_payload->>'resource_type',nullif(v_payload->>'staff_user_id','')::uuid,nullif(v_payload->>'equipment_id','')::uuid,nullif(v_payload->>'vehicle_id','')::uuid,coalesce((v_payload->>'quantity')::numeric,1),coalesce((v_payload->>'required')::boolean,true),coalesce(v_payload->>'status','planned'),v_payload->>'notes') returning to_jsonb(event_resources) into v_result;
   when 'vehicle_assignment' then insert into public.vehicle_assignments(vehicle_id,event_id,driver_user_id,starts_at,ends_at,status,notes) values((v_payload->>'vehicle_id')::uuid,nullif(v_payload->>'event_id','')::uuid,nullif(v_payload->>'driver_user_id','')::uuid,(v_payload->>'starts_at')::timestamptz,(v_payload->>'ends_at')::timestamptz,coalesce(v_payload->>'status','planned'),v_payload->>'notes') returning to_jsonb(vehicle_assignments) into v_result;
   else raise exception 'LINK_NOT_SUPPORTED';
  end case;
 elsif p_action='approve' and p_entity='offers' then
  update public.teklifler set status='accepted',accepted_at=coalesce(accepted_at,now()),updated_at=now() where id=p_id and status in ('new','reviewing','preparing','sent') returning to_jsonb(teklifler) into v_result;
  if v_result is null then raise exception 'OFFER_NOT_FOUND_OR_NOT_APPROVABLE'; end if;
 else
  v_table:=case p_entity when 'company' then 'business_settings' when 'customers' then 'customers' when 'offers' then 'teklifler' when 'offer_items' then 'offer_items' when 'jobs' then 'jobs' when 'events' then 'event_projects' when 'staff' then 'staff' when 'services' then 'services' when 'equipment' then 'equipment' when 'warehouse' then 'warehouse_locations' when 'equipment_movements' then 'equipment_movements' when 'vehicles' then 'vehicles' when 'vehicle_assignments' then 'vehicle_assignments' when 'event_resources' then 'event_resources' when 'payments' then 'payments' when 'settlements' then 'settlements' when 'event_financials' then 'event_financials' when 'business_risks' then 'business_risks' when 'event_risks' then 'event_risks' when 'contracts' then 'contracts' when 'suppliers' then 'stagepulse_suppliers' when 'marketing' then 'marketing_campaigns' when 'lead_sources' then 'lead_sources' when 'customer_segments' then 'customer_segments' when 'kpis' then 'executive_kpis' when 'goals' then 'executive_goals' when 'initiatives' then 'strategic_initiatives' when 'ai_tasks' then 'stagepulse_ai_tasks' when 'ai_actions' then 'ai_action_requests' when 'automation' then 'automation_rules' when 'approval_requests' then 'approval_requests' when 'risks' then 'stagepulse_risks' when 'decisions' then 'stagepulse_decisions' when 'app_versions' then 'app_versions' when 'site_media' then 'site_media' else null end;
  if v_table is null then raise exception 'ENTITY_NOT_SUPPORTED'; end if;
  if p_entity='company' and p_action in ('create','delete') then raise exception 'COMPANY_SINGLETON'; end if;
  if p_action='create' then
   if p_entity='app_versions' and not (v_payload ? 'id') then v_payload:=jsonb_set(v_payload,'{id}',to_jsonb(coalesce((select max(id)+1 from public.app_versions),1))); end if;
   execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I,$1) returning to_jsonb(%I)',v_table,v_table,v_table) into v_result using v_payload;
  elsif p_action='update' then
   if p_id is null then raise exception 'ID_REQUIRED'; end if;
   select string_agg(format('%I=%L',key,value),', ') into v_set from jsonb_each_text(v_payload) where key not in ('id','created_at','updated_at');
   if coalesce(v_set,'')='' then raise exception 'NO_FIELDS'; end if;
   v_where:=case when p_entity='company' then 'id=true' else format('id=%L',p_id) end;
   execute format('update public.%I set %s where %s returning to_jsonb(%I)',v_table,v_set,v_where,v_table) into v_result;
   if v_result is null then raise exception 'NOT_FOUND'; end if;
  elsif p_action='delete' then
   if p_id is null then raise exception 'ID_REQUIRED'; end if;
   execute format('delete from public.%I where id=%L returning jsonb_build_object(''id'',id)',v_table,p_id) into v_result using p_id;
   if v_result is null then raise exception 'NOT_FOUND'; end if;
  elsif p_action='approve' then
   if p_entity='approval_requests' then execute 'update public.approval_requests set status=''approved'',approved_by=$1,approved_at=now() where id=$2 and status=''pending'' returning to_jsonb(approval_requests)' into v_result using v_user,p_id;
   elsif p_entity='ai_actions' then execute 'update public.ai_action_requests set status=''approved'',approved_by=$1,approved_at=now() where id=$2 and status=''pending'' returning to_jsonb(ai_action_requests)' into v_result using v_user,p_id;
   else raise exception 'APPROVAL_NOT_SUPPORTED'; end if;
   if v_result is null then raise exception 'APPROVAL_NOT_FOUND_OR_ALREADY_PROCESSED'; end if;
  else raise exception 'ACTION_NOT_SUPPORTED'; end if;
 end if;
 insert into public.stagepulse_audit_log(actor_type,actor_id,action,target_type,target_id,result,metadata) values('user',v_user,p_action,p_entity,coalesce(p_id,(v_result->>'id')::uuid),'success',v_payload);
 return coalesce(v_result,'{}'::jsonb);
exception when others then
 insert into public.stagepulse_audit_log(actor_type,actor_id,action,target_type,target_id,result,metadata) values('user',v_user,p_action,p_entity,p_id,'failed',jsonb_build_object('error',sqlerrm,'payload',v_payload));
 raise;
end;
$function$;
revoke execute on function public.stagepulse_command_action(text,text,uuid,jsonb) from anon;
grant execute on function public.stagepulse_command_action(text,text,uuid,jsonb) to authenticated;

commit;
