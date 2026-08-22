CREATE OR REPLACE FUNCTION private.offer_evaluate(p_offer_id uuid, p_status text, p_note text DEFAULT NULL::text)
RETURNS public.teklifler
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
declare r public.teklifler; u uuid:=auth.uid(); v text:=lower(trim(coalesce(p_status,''))); eval_state text;
begin
 if u is null then raise exception 'Oturum gerekli'; end if;
 if not (public.staff_has_perm('offers.evaluate') or private.is_admin()) then raise exception 'Teklif değerlendirme yetkisi gerekli'; end if;
 if v not in ('accepted','rejected','reviewing') then raise exception 'Geçersiz değerlendirme durumu'; end if;
 eval_state:=case when v='reviewing' then 'evaluating' else 'completed' end;
 select * into r from public.teklifler where id=p_offer_id for update;
 if not found then raise exception 'Teklif bulunamadı'; end if;
 if r.evaluation_status='evaluating' and r.evaluated_by is distinct from u and not private.is_admin() then raise exception 'Teklif kilitli'; end if;
 update public.teklifler set status=case when v='accepted' then 'accepted' when v='rejected' then 'rejected' else status end,evaluation_status=eval_state,evaluated_by=u,evaluated_at=now(),rejected_at=case when v='rejected' then now() else rejected_at end,accepted_at=case when v='accepted' then now() else accepted_at end,updated_at=now() where id=p_offer_id returning * into r;
 if p_note is not null and length(trim(p_note))>0 then insert into public.activity_logs(actor_id,action,entity_type,entity_id,metadata) values(u,'offer_evaluation_note','teklifler',p_offer_id,jsonb_build_object('note',left(p_note,4000))); end if;
 insert into public.activity_logs(actor_id,action,entity_type,entity_id,metadata) values(u,'offer_evaluated','teklifler',p_offer_id,jsonb_build_object('status',v,'note',left(coalesce(p_note,''),4000)));
 if v in ('accepted','rejected') then insert into public.notifications(recipient_user_id,kind,title,body,offer_id) select s.user_id,'offer_evaluation','Teklif güncellendi',case when v='accepted' then 'Teklif kabul edildi.' else 'Teklif reddedildi.' end,p_offer_id from public.staff s where s.active=true and s.user_id<>u; end if;
 return r;
end $$;
