# Stagepulse Admin E2E Acceptance Checklist

This checklist is intentionally non-destructive. It defines real-user acceptance checks; CI must not mutate production data.

## Access
- [ ] Admin login succeeds without credentials appearing in URL
- [ ] Non-admin cannot open admin-only operations
- [ ] Refresh preserves authenticated admin state
- [ ] Logout terminates the session

## Core business flow
- [ ] Customer can be created and edited
- [ ] Offer can be created for an existing customer
- [ ] Accepted offer creates/links the job
- [ ] Job links to the event project
- [ ] Event shows customer, offer and financial context

## Operations
- [ ] Staff can be assigned to a job/event
- [ ] Assigned staff sees the job according to permissions
- [ ] Equipment can be assigned to an event
- [ ] Equipment state reflects reservation/assignment correctly
- [ ] Tasks/checklists are visible and actionable

## Finance
- [ ] Event financial record is visible
- [ ] Payment/settlement can be recorded by an authorized user
- [ ] Unauthorized user cannot mutate financial records
- [ ] Totals remain consistent across customer/offer/job/event views

## Approvals and notifications
- [ ] An approval request can be created
- [ ] Admin can approve/reject it
- [ ] Non-admin cannot approve another user's request
- [ ] Relevant operational events create notifications
- [ ] User can only access their permitted notifications

## AI
- [ ] AI panel loads without schema errors
- [ ] Action request uses the current schema
- [ ] Admin can approve/reject an action request
- [ ] AI cannot execute an action without the required approval
- [ ] Approved action produces an auditable result

## Security / RLS
- [ ] Staff cannot read another user's restricted records
- [ ] Staff cannot call admin-only mutations
- [ ] Direct RPC calls enforce authorization server-side
- [ ] Private schema is not exposed to anon/public
- [ ] No service-role credential is present in frontend assets

## UI / reliability
- [ ] No duplicate Command Center/Admin sections
- [ ] No stale cached JS after deployment
- [ ] Empty/loading/error states are usable
- [ ] Desktop and mobile layouts remain usable
- [ ] Browser console has no blocking Admin errors

## Final acceptance
- [ ] Customer → Offer → Job → Event → Staff → Equipment → Finance → Approval → Notification → AI chain passes
- [ ] CI passes after the final change
- [ ] No production test data remains
