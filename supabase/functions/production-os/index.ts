import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://stagepulse.com.tr',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-event-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'Runtime configuration unavailable' }, 500);

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Invalid session' }, 401);

  const admin = createClient(url, serviceKey);
  const userId = userData.user.id;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.action !== 'string') return json({ error: 'action is required' }, 400);

  const eventId = typeof body.client_event_id === 'string' ? body.client_event_id.slice(0, 160) : null;
  const action = body.action;

  if (action === 'timesheet_checkin' || action === 'timesheet_checkout') {
    const now = new Date().toISOString();
    if (action === 'timesheet_checkin') {
      const { data, error } = await admin.from('sp_staff_timesheets').upsert({
        user_id: userId,
        check_in_at: typeof body.check_in_at === 'string' ? body.check_in_at : now,
        status: 'draft',
        client_event_id: eventId,
        note: typeof body.note === 'string' ? body.note.slice(0, 1000) : null,
      }, { onConflict: 'user_id,client_event_id', ignoreDuplicates: false }).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, data });
    }
    const { data: open, error: openError } = await admin.from('sp_staff_timesheets').select('id').eq('user_id', userId).is('check_out_at', null).order('check_in_at', { ascending: false }).limit(1).maybeSingle();
    if (openError) return json({ error: openError.message }, 400);
    if (!open) return json({ error: 'Open timesheet not found' }, 404);
    const { data, error } = await admin.from('sp_staff_timesheets').update({ check_out_at: typeof body.check_out_at === 'string' ? body.check_out_at : now, note: typeof body.note === 'string' ? body.note.slice(0, 1000) : undefined }).eq('id', open.id).select().single();
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, data });
  }

  if (action === 'availability') {
    const starts = typeof body.starts_at === 'string' ? body.starts_at : null;
    const ends = typeof body.ends_at === 'string' ? body.ends_at : null;
    if (!starts || !ends) return json({ error: 'starts_at and ends_at are required' }, 400);
    const status = typeof body.status === 'string' ? body.status : 'available';
    const { data, error } = await admin.from('sp_staff_availability').insert({ user_id: userId, starts_at: starts, ends_at: ends, status, note: typeof body.note === 'string' ? body.note.slice(0, 1000) : null }).select().single();
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, data });
  }

  if (action === 'equipment_scan') {
    const code = typeof body.code === 'string' ? body.code.trim().slice(0, 160) : '';
    const scanAction = typeof body.scan_action === 'string' ? body.scan_action : 'inspect';
    if (!code) return json({ error: 'code is required' }, 400);
    const { data, error } = await admin.from('sp_equipment_scans').upsert({
      code,
      action: scanAction,
      equipment_id: typeof body.equipment_id === 'string' ? body.equipment_id : null,
      job_id: typeof body.job_id === 'string' ? body.job_id : null,
      scanned_by: userId,
      client_event_id: eventId,
      latitude: typeof body.latitude === 'number' ? body.latitude : null,
      longitude: typeof body.longitude === 'number' ? body.longitude : null,
      note: typeof body.note === 'string' ? body.note.slice(0, 1000) : null,
    }, { onConflict: 'scanned_by,client_event_id', ignoreDuplicates: false }).select().single();
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, data });
  }

  if (action === 'field_proof') {
    const proofType = typeof body.proof_type === 'string' ? body.proof_type : 'checklist';
    const { data, error } = await admin.from('sp_field_proofs').upsert({
      job_id: typeof body.job_id === 'string' ? body.job_id : null,
      user_id: userId,
      proof_type: proofType,
      file_path: typeof body.file_path === 'string' ? body.file_path.slice(0, 1000) : null,
      payload: typeof body.payload === 'object' && body.payload !== null ? body.payload : {},
      client_event_id: eventId,
    }, { onConflict: 'user_id,client_event_id', ignoreDuplicates: false }).select().single();
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, data });
  }

  if (action === 'readiness') {
    const jobId = typeof body.job_id === 'string' ? body.job_id : null;
    if (!jobId) return json({ error: 'job_id is required' }, 400);
    const { data, error } = await admin.from('sp_event_readiness').select('*').eq('job_id', jobId).maybeSingle();
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, data });
  }

  if (action === 'ai_recommendations') {
    const { data, error } = await admin.from('sp_ai_recommendations').select('*').in('status', ['pending','approved']).order('created_at', { ascending: false }).limit(25);
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, data });
  }

  return json({ error: 'Unsupported action' }, 400);
});
