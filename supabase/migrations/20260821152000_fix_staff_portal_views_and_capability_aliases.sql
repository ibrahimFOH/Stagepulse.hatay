-- Fix staff portal capability aliases and secure read views.
-- Legacy *_view capability names are kept as aliases to the canonical RBAC keys.
CREATE OR REPLACE FUNCTION public.staff_capability(p_capability text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.staff_has_perm(
    CASE p_capability
      WHEN 'equipment_view' THEN 'equipment.view'
      WHEN 'offers_view' THEN 'offers.view'
      WHEN 'customers_view' THEN 'customers.view'
      WHEN 'finance_view' THEN 'payments.view'
      WHEN 'pricing_view' THEN 'pricing.view'
      WHEN 'financials_view' THEN 'financials_view'
      WHEN 'activity_view' THEN 'activity_logs.view'
      WHEN 'analytics_view' THEN 'analytics.view'
      WHEN 'calendar_view' THEN 'schedule.view'
      WHEN 'jobs_view_assigned' THEN 'schedule.view'
      ELSE p_capability
    END
  );
$$;
REVOKE ALL ON FUNCTION public.staff_capability(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_capability(text) TO authenticated;

-- These views intentionally enforce authorization inside the view predicate.
-- security_invoker would additionally apply base-table RLS and block the safe
-- staff views, because the base tables are admin-only. The view exposes only
-- approved columns and the predicate is evaluated against auth.uid().
ALTER VIEW public.equipment_staff SET (security_invoker = false);
ALTER VIEW public.offers_staff SET (security_invoker = false);

CREATE OR REPLACE VIEW public.customers_staff AS
SELECT id, name, company, phone, email, last_contact_at, created_at
FROM public.customers
WHERE public.staff_capability('customers_view');

CREATE OR REPLACE VIEW public.payments_staff AS
SELECT pay.id, pay.offer_id, pay.description, pay.amount, pay.due_date,
       pay.paid_at, pay.status, pay.created_at,
       t.quote_number, t.name AS customer_name
FROM public.payments pay
JOIN public.teklifler t ON t.id = pay.offer_id
WHERE public.staff_capability('finance_view');

CREATE OR REPLACE VIEW public.pricing_staff AS
SELECT id, name, description, base_price, sort_order
FROM public.services
WHERE active = true AND public.staff_capability('pricing_view')
UNION ALL
SELECT id, name, NULL::text AS description, value AS base_price, 0 AS sort_order
FROM public.price_rules
WHERE active = true AND public.staff_capability('pricing_view');

CREATE OR REPLACE VIEW public.offers_financial_staff AS
SELECT id, quote_number, estimated_cost, estimated_price, discount, margin, total
FROM public.teklifler
WHERE status IN ('accepted','preparing','sent','new')
  AND public.staff_capability('offers_view')
  AND public.staff_capability('financials_view');

CREATE OR REPLACE VIEW public.equipment_financial_staff AS
SELECT id, daily_cost, daily_price
FROM public.equipment
WHERE active = true
  AND public.staff_capability('equipment_view')
  AND public.staff_capability('financials_view');

GRANT SELECT ON public.equipment_staff,
                 public.offers_staff,
                 public.customers_staff,
                 public.payments_staff,
                 public.pricing_staff,
                 public.offers_financial_staff,
                 public.equipment_financial_staff
TO authenticated;

NOTIFY pgrst, 'reload schema';
