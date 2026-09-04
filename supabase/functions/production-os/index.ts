import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const allowedOrigins = new Set(['https://stagepulse.com.tr', 'https://www.stagepulse.com.tr']);
const headersFor = (req: Request) => {
  const origin = req.headers.get('Origin') || 'https://stagepulse.com.tr';
  return { 'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://stagepulse.com.tr', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-event-id', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json; charset=utf-8', 'Vary': 'Origin' };
};
const json = (body: unknown, status: number, req: Request) => new Response(JSON.stringify(body), { status, headers: headersFor(req) });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: headersFor(req) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, req);
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401, req);
  const url = Deno.env.get('SUPABASE_URL'), anonKey = Deno.env.get('SUPABASE_ANON_KEY'), serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'Runtime configuration unavailable' }, 500, req);
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Invalid session' }, 401, req);
  const admin = createClient(url, serviceKey), userId = userData.user.id;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.action !== 'string') return json({ error: 'action is required' }, 400, req);
  const eventId = typeof body.client_event_id === 'string' ? body.client_event_id.slice(0, 160) : null;

  const insertIdempotent = async (table: string, payload: Record<string, unknown>, ownerColumn: string) => {
    if (eventId) {
      const existing = await admin.from(table).select('*').eq('client_event_id', eventId).eq(ownerColumn, userId).maybeSingle();
      if (existing.data) return { data: existing.data, error: null };
    }
    return await admin.from(table).insert(payload).select().single();
  };

  if (body.action === 'timesheet_checkin' || body.action === 'timesheet_checkout') {
    const now = new Date().toISOString();
    if (body.action === 'timesheet_checkin') {
      const r = await insertIdempotent('sp_staff_timesheets', { user_id: userId, check_in_at: typeof body.check_in_at === 'string' ? body.check_in_at : now, status: 'draft', client_event_id: eventId, note: typeof body.note === 'string' ? body.note.slice(0, 1000) : null }, 'user_id');
      if (r.error) return json({ error: r.error.message }, 400, req);
      return json({ ok: true, data: r.data }, 200, req);
    }
    const open = await admin.from('sp_staff_timesheets').select('id').eq('user_id', userId).is('check_out_at', null).order('check_in_at', { ascending: false }).limit(1).maybeSingle();
    if (open.error) return json({ error: open.error.message }, 400, req);
    if (!open.data) return json({ error: 'Open timesheet not found' }, 404, req);
    const r = await admin.from('sp_staff_timesheets').update({ check_out_at: typeof body.check_out_at === 'string' ? body.check_out_at : now, note: typeof body.note === 'string' ? body.note.slice(0, 1000) : undefined }).eq('id', open.data.id).select().single();
    if (r.error) return json({ error: r.error.message }, 400, req);
    return json({ ok: true, data: r.data }, 200, req);
  }

  if (body.action === 'availability') {
    const starts = typeof body.starts_at === 'string' ? body.starts_at : null, ends = typeof body.ends_at === 'string' ? body.ends_at : null;
    if (!starts || !ends) return json({ error: 'starts_at and ends_at are required' }, 400, req);
    const r = await admin.from('sp_staff_availability').insert({ user_id: userId, starts_at: starts, ends_at: ends, status: typeof body.status === 'string' ? body.status : 'available', note: typeof body.note === 'string' ? body.note.slice(0, 1000) : null }).select().single();
    if (r.error) return json({ error: r.error.message }, 400, req);
    return json({ ok: true, data: r.data }, 200, req);
  }

  if (body.action === 'equipment_scan') {
    const code = typeof body.code === 'string' ? body.code.trim().slice(0, 160) : '';
    if (!code) return json({ error: 'code is required' }, 400, req);
    const r = await insertIdempotent('sp_equipment_scans', { code, action: typeof body.scan_action === 'string' ? body.scan_action : 'inspect', equipment_id: typeof body.equipment_id === 'string' ? body.equipment_id : null, job_id: typeof body.job_id === 'string' ? body.job_id : null, scanned_by: userId, client_event_id: eventId, latitude: typeof body.latitude === 'number' ? body.latitude : null, longitude: typeof body.longitude === 'number' ? body.longitude : null, note: typeof body.note === 'string' ? body.note.slice(0, 1000) : null }, 'scanned_by');
    if (r.error) return json({ error: r.error.message }, 400, req);
    return json({ ok: true, data: r.data }, 200, req);
  }

  if (body.action === 'field_proof') {
    const r = await insertIdempotent('sp_field_proofs', { job_id: typeof body.job_id === 'string' ? body.job_id : null, user_id: userId, proof_type: typeof body.proof_type === 'string' ? body.proof_type : 'checklist', file_path: typeof body.file_path === 'string' ? body.file_path.slice(0, 1000) : null, payload: typeof body.payload === 'object' && body.payload !== null ? body.payload : {}, client_event_id: eventId }, 'user_id');
    if (r.error) return json({ error: r.error.message }, 400, req);
    return json({ ok: true, data: r.data }, 200, req);
  }

  if (body.action === 'readiness') {
    const jobId = typeof body.job_id === 'string' ? body.job_id : null;
    if (!jobId) return json({ error: 'job_id is required' }, 400, req);
    const r = await admin.from('sp_event_readiness').select('*').eq('job_id', jobId).maybeSingle();
    if (r.error) return json({ error: r.error.message }, 400, req);
    return json({ ok: true, data: r.data }, 200, req);
  }

  if (body.action === 'ai_recommendations') {
    const r = await admin.from('sp_ai_recommendations').select('*').in('status', ['pending','approved']).order('created_at', { ascending: false }).limit(25);
    if (r.error) return json({ error: r.error.message }, 400, req);
    return json({ ok: true, data: r.data }, 200, req);
  }
  return json({ error: 'Unsupported action' }, 400, req);
});
