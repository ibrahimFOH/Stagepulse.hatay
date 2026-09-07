begin;

-- Conversational AI agents are proposal/read only. Execution requires an explicit
-- owner-controlled capability and is disabled by default for the canonical set.
update public.ai_agents
set can_execute = false,
    updated_at = now()
where active = true
  and can_execute = true;

commit;
