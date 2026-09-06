begin;
update public.ai_agents set active=false,can_read=false,can_propose=false,can_execute=false,updated_at=now() where code in ('stagepulse-command','operations-planner','sales-assistant','staff-assistant','inventory-assistant');
update public.ai_agents set can_execute=false,updated_at=now() where active=true;
create or replace function private.admin_update_ai_agent(p_code text,p_active boolean,p_can_read boolean,p_can_propose boolean,p_can_execute boolean)
returns public.ai_agents language plpgsql security definer set search_path to 'public' as $$
declare r public.ai_agents;
begin
 if not private.is_org_owner() then raise exception 'AI çalıştırma ayarlarını yalnızca Patron değiştirebilir.'; end if;
 update public.ai_agents set active=coalesce(p_active,active),can_read=coalesce(p_can_read,can_read),can_propose=coalesce(p_can_propose,can_propose),can_execute=coalesce(p_can_execute,can_execute),updated_at=now() where code=p_code returning * into r;
 if r.id is null then raise exception 'AI bulunamadı.'; end if; return r;
end;
$$;
revoke all on function private.admin_update_ai_agent(text,boolean,boolean,boolean,boolean) from public,anon,authenticated;
commit;
