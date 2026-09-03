begin;

-- Patron / Owner is the only unconditional admin.
-- CEO, Super Admin and all other users are capability-based and can be restricted by the Patron.

create or replace function private.admin_has_capability(p_capability text)
returns boolean language sql stable security definer
set search_path = 'public, pg_temp'
as $$
  select private.is_org_owner()
      or exists (
        select 1
        from public.admin_capability_grants g
        join public.admin_capabilities c on c.key=g.capability_key and c.active=true
        where g.user_id=auth.uid() and g.enabled=true and g.capability_key=p_capability
      );
$$;

create or replace function private.staff_has_exact_perm(p_key text)
returns boolean language sql stable security definer
set search_path = 'public, pg_temp'
as $$ select private.admin_has_capability(p_key); $$;

create or replace function private.staff_has_perm(p_keys text[])
returns boolean language sql stable security definer
set search_path = 'public, pg_temp'
as $$
  select coalesce(bool_or(private.admin_has_capability(k)),false) from unnest(p_keys) k;
$$;

create or replace function private.staff_capability(p_capability text)
returns boolean language sql stable security definer
set search_path = 'public, private'
as $$ select private.admin_has_capability(p_capability); $$;

-- Only the Patron can change capability assignments. Other admin-role users cannot grant themselves access.
create or replace function private.can_use_admin_capability(p_capability_key text,p_user_id uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select public.is_org_owner()
     and exists (select 1 from public.admin_capabilities c where c.key=p_capability_key and c.active);
$$;

create or replace function public.staff_capabilities(p_user_id uuid default null)
returns jsonb language sql stable security definer
set search_path = 'public, private'
as $$
  select coalesce(jsonb_object_agg(c.key,
    case when private.is_org_owner() then true else coalesce(g.enabled,false) end
  ),'{}'::jsonb)
  from public.admin_capabilities c
  left join public.admin_capability_grants g
    on g.capability_key=c.key and g.user_id=coalesce(p_user_id,auth.uid())
  where c.active=true
    and (private.is_org_owner() or coalesce(p_user_id,auth.uid())=auth.uid());
$$;

-- Replace blanket admin-role gates with the capability required by each operation.
do $$
declare r record; v_def text;
begin
  for r in select * from (values
    ('admin_delete_offer(uuid)'::regprocedure,'offers.delete'),
    ('admin_update_ai_agent(text,boolean,boolean,boolean,boolean)'::regprocedure,'ai.update'),
    ('admin_update_price_rule(uuid,numeric,boolean,text)'::regprocedure,'pricing.manage'),
    ('admin_update_service_pricing(uuid,numeric,numeric,integer,integer,integer,numeric,numeric,numeric,numeric,boolean)'::regprocedure,'external_services.manage'),
    ('admin_set_service_active(uuid,boolean)'::regprocedure,'external_services.manage'),
    ('admin_set_price_rule_active(uuid,boolean)'::regprocedure,'pricing.manage'),
    ('admin_create_service(text,text,numeric,numeric,integer,integer,integer,numeric,numeric,numeric,numeric)'::regprocedure,'external_services.manage'),
    ('admin_create_price_rule(text,text,numeric,text)'::regprocedure,'pricing.manage'),
    ('admin_set_offer_pdf_visibility(uuid,boolean)'::regprocedure,'offers.pdf.visibility'),
    ('admin_upsert_offer_item_equipment(uuid,uuid,numeric,text)'::regprocedure,'offers.equipment'),
    ('admin_set_offer_crew_count(uuid,integer)'::regprocedure,'offers.crew'),
    ('admin_set_offer_inventory_reserved(uuid,uuid,numeric)'::regprocedure,'inventory.manage'),
    ('admin_remove_offer_pdf_asset(uuid)'::regprocedure,'offers.pdf.generate'),
    ('admin_set_offer_pdf_current(uuid)'::regprocedure,'offers.pdf.generate'),
    ('admin_remove_offer_item_equipment(uuid,uuid)'::regprocedure,'offers.equipment'),
    ('admin_offer_pdf_url(uuid)'::regprocedure,'offers.pdf.download'),
    ('admin_delete_offer_attachment(uuid)'::regprocedure,'offers.attachments'),
    ('admin_set_offer_attachment_visibility(uuid,boolean)'::regprocedure,'offers.attachments')
  ) as x(sig,key)
  loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p where p.oid=r.sig;
    if v_def is not null then execute replace(v_def,'private.is_admin()',format('private.admin_has_capability(%L)',r.key)); end if;
  end loop;
end $$;

do $$
declare r record; v_def text;
begin
  for r in select * from (values
    ('admin_update_business_settings(jsonb)'::regprocedure,'admin.accounts.manage'),
    ('admin_get_offer_pdf_assets(uuid)'::regprocedure,'offers.pdf.download'),
    ('admin_get_offer_pdf_state(uuid)'::regprocedure,'offers.pdf.preview'),
    ('admin_get_offer_attachments(uuid)'::regprocedure,'offers.attachments'),
    ('admin_register_offer_attachment(uuid,text,text,text,bigint,integer,boolean)'::regprocedure,'offers.attachments')
  ) as x(sig,key)
  loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p where p.oid=r.sig;
    if v_def is not null then execute replace(v_def,'private.is_admin()',format('private.admin_has_capability(%L)',r.key)); end if;
  end loop;
end $$;

create or replace function private.staff_can_any(p_keys text[])
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(bool_or(private.admin_has_capability(k)),false) from unnest(p_keys) k; $$;

create or replace function private.staff_list_jobs()
returns setof public.jobs language plpgsql stable security definer
set search_path = 'public, private'
as $$
begin
  if private.admin_has_capability('jobs.view') or private.admin_has_capability('schedule.view') or private.admin_has_capability('schedule.manage') then
    return query select j.* from public.jobs j order by j.event_at nulls last,j.created_at desc nulls last; return;
  end if;
  if not public.is_active_staff() then return; end if;
  if private.admin_has_capability('view_assigned_jobs') then
    return query select j.* from public.jobs j join public.job_assignments ja on ja.job_id=j.id where ja.user_id=auth.uid() order by j.event_at nulls last,j.created_at desc nulls last;
  end if;
end;
$$;

create or replace function private.get_owner_financial_summary()
returns table(total_revenue numeric,total_expense numeric,total_net numeric,owner_revenue numeric,owner_expense numeric,owner_profit numeric,job_count integer)
language sql stable security definer set search_path = 'public, private'
as $$ select total_revenue,total_expense,total_net,owner_revenue,owner_expense,owner_profit,job_count from public.owner_financial_summary where private.admin_has_capability('finance.view'); $$;

create or replace function public.approve_ai_action_request(p_request_id uuid,p_approve boolean)
returns public.ai_action_requests language plpgsql set search_path = 'public, pg_temp'
as $$
declare r public.ai_action_requests;
begin
  if not private.admin_has_capability('ai.approvals.manage') then raise exception 'admin_required'; end if;
  update public.ai_action_requests set status=case when p_approve then 'approved' else 'rejected' end,approved_by=auth.uid(),approved_at=now() where id=p_request_id and status='pending' returning * into r;
  if r.id is null then raise exception 'ai_action_request_not_pending'; end if;
  return r;
end;
$$;

create or replace function public.admin_org_bootstrap_check()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select case when private.admin_has_capability('admin.accounts.manage') then jsonb_build_object(
    'supabase_url','https://mtjcqqrogjqaxkagwkti.supabase.co',
    'org_roles_count',(select count(*) from public.org_roles where active),
    'org_departments_count',(select count(*) from public.org_departments where active),
    'org_regions_count',(select count(*) from public.org_regions where active),
    'admin_capabilities_count',(select count(*) from public.admin_capabilities where active)
  ) else jsonb_build_object('authorized',false) end;
$$;

grant execute on function public.staff_capabilities(uuid) to authenticated;
grant execute on function public.staff_capability(text) to authenticated;

commit;
