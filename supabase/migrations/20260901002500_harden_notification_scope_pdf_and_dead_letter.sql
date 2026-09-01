begin;

-- The current schema has one canonical Stagepulse organization. org_memberships
-- is intentionally a single-membership model (user_id is its primary key), so
-- this migration does not add tenant columns or imply multi-tenant isolation.
-- Quote fan-out is limited to that canonical membership population only.
create or replace function public.on_quote_after_notify()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_body text;
begin
  v_body := concat_ws(E'\n',
    'Merhaba, Stagepulse üzerinden teklif almak istiyorum.',
    '',
    'Ad Soyad / Firma: ' || coalesce(new.name, ''),
    case when nullif(new.company, '') is not null then 'Firma: ' || new.company end,
    case when nullif(new.email, '') is not null then 'E-posta: ' || new.email end,
    'Telefon: ' || coalesce(new.phone, ''),
    'Etkinlik Türü: ' || coalesce(new.event_type, ''),
    'Hizmet: ' || coalesce(new.type, ''),
    'Lokasyon: ' || coalesce(new.location, ''),
    'Katılımcı: ' || coalesce(new.people::text, ''),
    'Etkinlik Tarihi: ' || coalesce(new.event_date::text, ''),
    'Detay: ' || coalesce(new.message, '')
  );

  insert into public.notifications(
    recipient_user_id, kind, title, body, offer_id
  )
  select distinct
    membership.user_id,
    'new_quote',
    'Yeni teklif talebi',
    left(v_body, 4000),
    new.id
  from public.org_memberships membership
  join public.org_roles role
    on role.id = membership.role_id
   and role.active = true
  where membership.active = true
    and membership.user_id is not null
    and (
      role.is_admin_role = true
      or exists (
        select 1
        from public.admin_capability_grants grant_row
        join public.admin_capabilities capability
          on capability.key = grant_row.capability_key
         and capability.active = true
        where grant_row.user_id = membership.user_id
          and grant_row.enabled = true
          and grant_row.capability_key = 'offers.view'
      )
    );

  return new;
exception when others then
  raise warning 'new offer notification failed: %', sqlerrm;
  return new;
end;
$$;

-- The bucket remains private and accepts PDFs only. Existing objects are kept,
-- but HTML and other active-content uploads are rejected from this point on.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('offer-pdfs', 'offer-pdfs', false, 52428800, array['application/pdf'])
on conflict(id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.offer_pdf_assets'::regclass
      and conname = 'offer_pdf_assets_pdf_mime_check'
  ) then
    alter table public.offer_pdf_assets
      add constraint offer_pdf_assets_pdf_mime_check
      check (mime_type = 'application/pdf') not valid;
  end if;
end;
$$;

-- Storage paths are internal capabilities. Public clients use the Edge endpoint;
-- only service_role may resolve a validated current object to its private path.
create or replace function public.get_customer_offer_pdf_by_code(p_code text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select case
    when coalesce(t.pdf_customer_visible, true)
      and t.pdf_storage_path is not null
      and (t.validity_until is null or t.validity_until >= now())
      and t.status not in ('cancelled', 'archived', 'expired')
      and exists (
        select 1
        from public.offer_pdf_assets asset
        where asset.offer_id = t.id
          and asset.storage_path = t.pdf_storage_path
          and asset.is_current
          and asset.customer_visible
          and asset.mime_type = 'application/pdf'
      )
    then jsonb_build_object(
      'file_name', t.pdf_file_name,
      'storage_path', t.pdf_storage_path,
      'updated_at', t.pdf_updated_at
    )
    else null
  end
  from public.teklifler t
  where upper(t.public_code) = upper(trim(p_code))
  limit 1;
$$;

revoke all on function public.get_customer_offer_pdf_by_code(text)
from public, anon, authenticated;
grant execute on function public.get_customer_offer_pdf_by_code(text) to service_role;

comment on function public.get_customer_offer_pdf_by_code(text) is
'PROTECTED CORE: service-role-only resolution of a customer-visible, current application/pdf object; private storage paths are never exposed by direct anon RPC.';

-- Durable dead-letter state gives operators a bounded, auditable replay path.
create table if not exists public.notification_push_dead_letters (
  notification_id bigint primary key
    references public.notifications(id) on delete cascade,
  attempt_count integer not null,
  last_error text,
  failed_at timestamptz not null default now(),
  replay_count integer not null default 0,
  last_replayed_at timestamptz,
  check (attempt_count >= 6),
  check (replay_count >= 0)
);

create index if not exists notification_push_dead_letters_failed_idx
on public.notification_push_dead_letters(failed_at desc, notification_id);

alter table public.notification_push_dead_letters enable row level security;
revoke all on public.notification_push_dead_letters from public, anon, authenticated;
grant select on public.notification_push_dead_letters to authenticated;
drop policy if exists notification_push_dead_letters_operator_select
on public.notification_push_dead_letters;
create policy notification_push_dead_letters_operator_select
on public.notification_push_dead_letters
for select to authenticated
using (private.is_admin());

create or replace function private.sync_notification_push_dead_letter()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.push_dispatched_at is not null or new.push_attempt_count < 6 then
    delete from public.notification_push_dead_letters
    where notification_id = new.id;
  else
    insert into public.notification_push_dead_letters(
      notification_id, attempt_count, last_error, failed_at
    )
    values (
      new.id, new.push_attempt_count, new.push_last_error,
      coalesce(new.push_last_attempt_at, now())
    )
    on conflict (notification_id) do update
    set attempt_count = excluded.attempt_count,
        last_error = excluded.last_error,
        failed_at = excluded.failed_at;
  end if;
  return new;
end;
$$;

revoke all on function private.sync_notification_push_dead_letter()
from public, anon, authenticated;

drop trigger if exists trg_notification_push_dead_letter on public.notifications;
create trigger trg_notification_push_dead_letter
after insert or update of push_attempt_count, push_dispatched_at, push_last_error
on public.notifications
for each row execute function private.sync_notification_push_dead_letter();

insert into public.notification_push_dead_letters(
  notification_id, attempt_count, last_error, failed_at
)
select
  n.id, n.push_attempt_count, n.push_last_error,
  coalesce(n.push_last_attempt_at, n.created_at, now())
from public.notifications n
where n.push_dispatched_at is null
  and n.push_attempt_count >= 6
on conflict (notification_id) do update
set attempt_count = excluded.attempt_count,
    last_error = excluded.last_error,
    failed_at = excluded.failed_at;

create or replace function public.admin_replay_notification_push(
  p_notification_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $$
declare
  v_replay_count integer;
  v_request_id bigint;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Yönetici yetkisi gerekli.' using errcode = '42501';
  end if;

  update public.notification_push_dead_letters dead_letter
  set replay_count = replay_count + 1,
      last_replayed_at = now()
  where dead_letter.notification_id = p_notification_id
  returning replay_count into v_replay_count;

  if v_replay_count is null then
    raise exception 'Dead-letter notification not found.';
  end if;

  update public.notifications
  set push_attempt_count = 0,
      push_next_attempt_at = now(),
      push_claim_token = null,
      push_claimed_at = null,
      push_last_error = null,
      push_dispatch_token = gen_random_uuid()
  where id = p_notification_id
    and push_dispatched_at is null;

  if not found then
    delete from public.notification_push_dead_letters
    where notification_id = p_notification_id;
    raise exception 'Notification is already delivered or no longer exists.';
  end if;

  v_request_id := private.enqueue_notification_push(p_notification_id);
  return jsonb_build_object(
    'notification_id', p_notification_id,
    'replay_count', v_replay_count,
    'request_id', v_request_id,
    'queued', v_request_id is not null
  );
end;
$$;

revoke all on function public.admin_replay_notification_push(bigint)
from public, anon, authenticated;
grant execute on function public.admin_replay_notification_push(bigint)
to authenticated;

comment on table public.notification_push_dead_letters is
'Operator-visible terminal push failures. Rows are removed after delivery or replay reset; replay is restricted to canonical admins.';
comment on function public.admin_replay_notification_push(bigint) is
'Admin-only replay: resets the bounded retry state and immediately queues one new delivery attempt.';

-- Migration assertions: fail atomically if a security boundary was not applied.
do $$
begin
  -- The source schema is deliberately single-organization: each user has one
  -- canonical membership. Refuse to silently coexist with tenant columns,
  -- which would create partial cross-tenant semantics without a full model.
  if not exists (
    select 1
    from pg_index index_row
    where index_row.indrelid = 'public.org_memberships'::regclass
      and index_row.indisprimary
      and pg_get_indexdef(index_row.indexrelid) like '%(user_id)%'
  ) then
    raise exception 'Canonical single-organization membership validation failed';
  end if;

  if exists (
    select 1
    from information_schema.columns column_row
    where column_row.table_schema = 'public'
      and column_row.table_name in ('org_memberships', 'teklifler', 'notifications')
      and column_row.column_name = 'organization_id'
  ) or to_regclass('public.organizations') is not null then
    raise exception 'Partial multi-tenant schema detected; a complete tenant model is required';
  end if;

  if position(
    'from public.org_memberships membership'
    in lower(pg_get_functiondef('public.on_quote_after_notify()'::regprocedure))
  ) = 0 then
    raise exception 'Canonical quote recipient scope validation failed';
  end if;

  if exists (
    select 1
    from pg_proc proc
    join pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'private'
      and proc.proname = 'is_admin_for_organization'
  ) then
    raise exception 'Partial tenant authorization helper must not be present';
  end if;

  if not exists (
    select 1
    from storage.buckets b
    where b.id = 'offer-pdfs'
      and b.public = false
      and b.allowed_mime_types = array['application/pdf']::text[]
  ) then
    raise exception 'offer-pdfs bucket hardening validation failed';
  end if;

  if has_function_privilege(
    'anon',
    'public.get_customer_offer_pdf_by_code(text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.get_customer_offer_pdf_by_code(text)',
    'EXECUTE'
  ) then
    raise exception 'Public offer PDF resolver ACL validation failed';
  end if;
end;
$$;

commit;