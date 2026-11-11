-- Stagepulse-core security hardening (free-plan compatible).
-- Keep the public RPC contract, but move privileged implementations out of the exposed API schema.
DO $migration$
DECLARE
  r record;
  v_target_name text;
  v_call_args text;
  v_select_sql text;
  v_attributes text;
  v_exec_role text;
BEGIN
  FOR r IN
    SELECT p.proname,
           pg_get_function_identity_arguments(p.oid) AS identity_args,
           pg_get_function_arguments(p.oid) AS full_args,
           pg_get_function_result(p.oid) AS result_type,
           p.pronargs,
           p.proretset,
           p.provolatile,
           p.proisstrict,
           p.proparallel
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosecdef = true
      AND p.proname = ANY (ARRAY[
        'admin_has_capability',
        'admin_replay_notification_push',
        'can_manage_org_member',
        'get_owner_financial_summary',
        'get_public_quote',
        'is_admin',
        'is_admin_or_staff',
        'is_org_owner',
        'is_staff',
        'org_role_tier_for',
        'respond_to_quote',
        'staff_create_offer',
        'staff_has_perm',
        'staff_respond_job',
        'staff_update_job_notes',
        'staff_update_job_status'
      ])
    ORDER BY p.proname
  LOOP
    v_target_name := '_api_' || r.proname;

    EXECUTE format(
      'ALTER FUNCTION public.%I(%s) RENAME TO %I',
      r.proname, r.identity_args, v_target_name
    );
    EXECUTE format(
      'ALTER FUNCTION public.%I(%s) SET SCHEMA private',
      v_target_name, r.identity_args
    );

    SELECT string_agg('$' || g.i::text, ', ' ORDER BY g.i)
      INTO v_call_args
    FROM generate_series(1, r.pronargs) AS g(i);

    v_call_args := coalesce(v_call_args, '');
    IF r.proretset THEN
      v_select_sql := format('SELECT * FROM private.%I(%s)', v_target_name, v_call_args);
    ELSE
      v_select_sql := format('SELECT private.%I(%s)', v_target_name, v_call_args);
    END IF;

    v_attributes := CASE r.provolatile
      WHEN 'i' THEN 'IMMUTABLE'
      WHEN 's' THEN 'STABLE'
      ELSE 'VOLATILE'
    END;
    IF r.proisstrict THEN
      v_attributes := v_attributes || ' STRICT';
    END IF;
    v_attributes := v_attributes || CASE r.proparallel
      WHEN 's' THEN ' PARALLEL SAFE'
      WHEN 'r' THEN ' PARALLEL RESTRICTED'
      ELSE ' PARALLEL UNSAFE'
    END;

    EXECUTE format(
      'CREATE FUNCTION public.%I(%s) RETURNS %s LANGUAGE sql %s SECURITY INVOKER SET search_path = %L AS %L',
      r.proname, r.full_args, r.result_type, v_attributes, '', v_select_sql
    );

    EXECUTE format(
      'ALTER FUNCTION private.%I(%s) SET search_path = %L',
      v_target_name, r.identity_args, ''
    );

    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
      r.proname, r.identity_args
    );
    EXECUTE format(
      'REVOKE ALL ON FUNCTION private.%I(%s) FROM PUBLIC',
      v_target_name, r.identity_args
    );

    IF r.proname IN ('get_public_quote', 'respond_to_quote') THEN
      v_exec_role := 'anon';
    ELSE
      v_exec_role := 'authenticated';
    END IF;

    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.%I(%s) TO %I, service_role',
      r.proname, r.identity_args, v_exec_role
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION private.%I(%s) TO %I, service_role',
      v_target_name, r.identity_args, v_exec_role
    );
  END LOOP;
END
$migration$;

DO $policies$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sesm_document_events',
    'sesm_education_documents',
    'sesm_exam_attempts',
    'sesm_exams',
    'sesm_purchase_requests',
    'sesm_questions',
    'sesm_store_settings'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      'deny_client_access_' || t, t
    );
  END LOOP;
END
$policies$;

GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;
