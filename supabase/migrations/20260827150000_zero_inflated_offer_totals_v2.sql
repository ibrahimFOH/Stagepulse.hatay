-- Eski people×kişi başı şişirmesi kalan lead/teklifleri temizle.
-- Kabul edilmiş / kapalı işlere dokunma.

update public.teklifler
set total = 0,
    estimated_price = 0,
    estimated_cost = 0,
    margin = 0,
    updated_at = now()
where coalesce(total, 0) > 1000000
  and accepted_at is null
  and status in ('new', 'reviewing', 'preparing', 'sent');

-- Kişi başı kural notunu netleştir (seyirci değil ekip)
update public.price_rules
set notes = 'Ekip (çalışan) kişi başı. Seyirci/people alanına ASLA çarpılmaz. Formül: taban + kurulum + söküm + (ekip_sayısı × bu ücret).',
    updated_at = now()
where name = 'Kişi başı ek ücret';

notify pgrst, 'reload schema';
