begin;

-- Admin/Patron/Super Admin roles are full-access roles.
-- Staff remains capability-based.

create or replace function private.staff_has_exact_perm(p_key text)
returns boolean language sql stable security definer
set search_path to 'public, pg_temp'
as $$
  select exists (
    select 1 from public.org_memberships m
    join public.org_roles r on r.id=m.role_id and r.active=true
    where m.user_id=auth.uid() and m.active=true and r.is_admin_role=true
  )
  or exists (
    select 1 from public.org_memberships m
    join public.admin_capability_grants g on g.user_id=m.user_id and g.enabled=true
    join public.admin_capabilities c on c.key=g.capability_key and c.active=true
    where m.user_id=auth.uid() and m.active=true and g.capability_key=p_key
  );
$$;

create or replace function private.staff_has_perm(p_keys text[])
returns boolean language sql stable security definer
set search_path to 'public, pg_temp'
as $$
  select exists (select 1 from unnest(p_keys) k where private.staff_has_exact_perm(k));
$$;

create or replace function private.staff_capability(p_capability text)
returns boolean language sql stable security definer
set search_path to 'public, private'
as $$
  select exists (
    select 1 from public.org_memberships m
    join public.org_roles r on r.id=m.role_id and r.active=true
    where m.user_id=auth.uid() and m.active=true and r.is_admin_role=true
  )
  or exists (
    select 1 from public.admin_capability_grants g
    join public.admin_capabilities c on c.key=g.capability_key and c.active=true
    where g.user_id=auth.uid() and g.enabled=true and g.capability_key=p_capability
  );
$$;

create or replace function private.can_use_admin_capability(p_capability_key text,p_user_id uuid)
returns boolean language sql stable security definer
set search_path to ''
as $$
  select case
    when exists (
      select 1 from public.org_memberships m
      join public.org_roles r on r.id=m.role_id and r.active=true
      where m.user_id=auth.uid() and m.active=true and r.is_admin_role=true
    ) and p_user_id=auth.uid() then true
    when not public.is_org_owner() and p_user_id<>auth.uid() then false
    else exists (
      select 1 from public.admin_capability_grants g
      join public.org_memberships om on om.user_id=g.user_id and om.active
      join public.org_roles r on r.id=om.role_id and r.is_admin_role
      join public.admin_capabilities c on c.key=g.capability_key and c.active
      where g.user_id=p_user_id and g.enabled and g.capability_key=p_capability_key
    )
  end;
$$;

create or replace function public.staff_capabilities(p_user_id uuid default null)
returns jsonb language sql stable security definer
set search_path to 'public, private'
as $$
  select coalesce(jsonb_object_agg(c.key,
    case when exists (
      select 1 from public.org_memberships m
      join public.org_roles r on r.id=m.role_id
      where m.user_id=auth.uid() and m.active=true and r.active=true and r.is_admin_role=true
    ) then true else coalesce(g.enabled,false) end
  ),'{}'::jsonb)
  from public.admin_capabilities c
  left join public.admin_capability_grants g
    on g.capability_key=c.key
   and g.user_id=case
      when exists (
        select 1 from public.org_memberships m
        join public.org_roles r on r.id=m.role_id
        where m.user_id=auth.uid() and m.active=true and r.active=true and r.is_admin_role=true
      ) then coalesce(p_user_id,auth.uid()) else auth.uid() end
  where c.active=true;
$$;

-- Admin-only private functions use the same canonical admin-role gate.
create or replace function private.admin_create_price_rule(p_name text,p_rule_type text,p_value numeric,p_notes text)
returns public.price_rules language plpgsql security definer set search_path to 'public' as $$
declare r public.price_rules; begin
 if not private.is_admin() then raise exception 'Yönetici yetkisi gerekli.'; end if;
 if p_rule_type not in ('fixed','per_person','per_km','percent','multiplier') then raise exception 'Geçersiz kural tipi.'; end if;
 insert into public.price_rules(name,rule_type,value,notes,active) values(left(trim(p_name),120),p_rule_type,coalesce(p_value,0),left(coalesce(p_notes,''),2000),true) returning * into r; return r;
end; $$;

create or replace function private.admin_create_service(p_name text,p_description text,p_base_price numeric,p_base_cost numeric,p_crew_min integer,p_crew_max integer,p_default_crew integer,p_crew_unit_price numeric,p_setup_fee numeric,p_teardown_fee numeric,p_margin_pct numeric)
returns public.services language plpgsql security definer set search_path to 'public' as $$
declare r public.services; vmin integer; vmax integer; vdef integer; begin
 if not private.is_admin() then raise exception 'Yönetici yetkisi gerekli.'; end if;
 if nullif(trim(p_name),'') is null then raise exception 'Hizmet adı gerekli.'; end if;
 vmin:=greatest(1,least(coalesce(p_crew_min,1),12)); vmax:=greatest(vmin,least(coalesce(p_crew_max,12),12)); vdef:=greatest(vmin,least(coalesce(p_default_crew,vmin),vmax));
 insert into public.services(name,description,base_price,base_cost,active,crew_min,crew_max,default_crew,crew_unit_price,setup_fee,teardown_fee,margin_pct) values(left(trim(p_name),120),left(coalesce(p_description,''),2000),greatest(0,coalesce(p_base_price,0)),greatest(0,coalesce(p_base_cost,0)),true,vmin,vmax,vdef,greatest(0,coalesce(p_crew_unit_price,0)),greatest(0,coalesce(p_setup_fee,0)),greatest(0,coalesce(p_teardown_fee,0)),greatest(0,coalesce(p_margin_pct,35))) returning * into r; return r;
end; $$;

create or replace function private.admin_delete_offer(p_offer_id uuid)
returns boolean language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare deleted boolean:=false; begin
 if not private.is_admin() and not public.staff_has_perm('offers.delete') then raise exception 'permission denied for offer deletion'; end if;
 delete from public.teklifler where id=p_offer_id; deleted:=found; return deleted;
end; $$;

create or replace function private.admin_set_price_rule_active(p_id uuid,p_active boolean)
returns boolean language plpgsql security definer set search_path to 'public' as $$ begin
 if not private.is_admin() then raise exception 'Yönetici yetkisi gerekli.'; end if;
 update public.price_rules set active=coalesce(p_active,false),updated_at=now() where id=p_id; return found;
end; $$;

create or replace function private.admin_set_service_active(p_id uuid,p_active boolean)
returns boolean language plpgsql security definer set search_path to 'public' as $$ begin
 if not private.is_admin() then raise exception 'Yönetici yetkisi gerekli.'; end if;
 update public.services set active=coalesce(p_active,false) where id=p_id; return found;
end; $$;

create or replace function private.admin_update_ai_agent(p_code text,p_active boolean,p_can_read boolean,p_can_propose boolean,p_can_execute boolean)
returns public.ai_agents language plpgsql security definer set search_path to 'public' as $$
declare r public.ai_agents; begin
 if not private.is_admin() then raise exception 'Yönetici yetkisi gerekli.'; end if;
 update public.ai_agents set active=coalesce(p_active,active),can_read=coalesce(p_can_read,can_read),can_propose=coalesce(p_can_propose,can_propose),can_execute=coalesce(p_can_execute,can_execute) where code=p_code returning * into r;
 if r.id is null then raise exception 'AI bulunamadı.'; end if; return r;
end; $$;

create or replace function private.admin_update_price_rule(p_id uuid,p_value numeric,p_active boolean,p_notes text)
returns public.price_rules language plpgsql security definer set search_path to 'public' as $$
declare r public.price_rules; begin
 if not private.is_admin() then raise exception 'Yönetici yetkisi gerekli.'; end if;
 update public.price_rules set value=coalesce(p_value,value),active=coalesce(p_active,active),notes=case when p_notes is null then notes else left(p_notes,2000) end,updated_at=now() where id=p_id returning * into r;
 if r.id is null then raise exception 'Fiyat kuralı bulunamadı.'; end if; return r;
end; $$;

create or replace function private.admin_update_service_pricing(p_id uuid,p_base_price numeric,p_base_cost numeric,p_crew_min integer,p_crew_max integer,p_default_crew integer,p_crew_unit_price numeric,p_setup_fee numeric,p_teardown_fee numeric,p_margin_pct numeric,p_active boolean)
returns public.services language plpgsql security definer set search_path to 'public' as $$
declare r public.services; vmin integer; vmax integer; vdef integer; begin
 if not private.is_admin() then raise exception 'Yönetici yetkisi gerekli.'; end if;
 vmin:=greatest(1,least(coalesce(p_crew_min,1),12)); vmax:=greatest(vmin,least(coalesce(p_crew_max,12),12)); vdef:=greatest(vmin,least(coalesce(p_default_crew,vmin),vmax));
 update public.services set base_price=greatest(0,coalesce(p_base_price,base_price)),base_cost=greatest(0,coalesce(p_base_cost,base_cost)),crew_min=vmin,crew_max=vmax,default_crew=vdef,crew_unit_price=greatest(0,coalesce(p_crew_unit_price,crew_unit_price)),setup_fee=greatest(0,coalesce(p_setup_fee,setup_fee)),teardown_fee=greatest(0,coalesce(p_teardown_fee,teardown_fee)),margin_pct=greatest(0,coalesce(p_margin_pct,margin_pct)),active=coalesce(p_active,active) where id=p_id returning * into r;
 if r.id is null then raise exception 'Hizmet bulunamadı.'; end if; return r;
end; $$;

grant execute on function public.staff_capabilities(uuid) to authenticated;
grant execute on function public.staff_capability(text) to authenticated;

commit;
