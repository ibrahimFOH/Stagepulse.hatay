-- Stagepulse: teklif ekip sayısı 3'e kilitlenmesin.
-- Ses ışık truss kiralama: 2-6 kişi, varsayılan 3.
-- SES SİSTEMİ: 2-4 kişi, varsayılan 3.
begin;

update public.services
set
  crew_min = 2,
  crew_max = 6,
  default_crew = 3
where name = 'Ses ışık truss kiralama';

update public.services
set
  crew_min = 2,
  crew_max = 4,
  default_crew = 3
where name = 'SES SİSTEMİ';

-- Mevcut tekliflerde geçersiz değerleri hizmet sınırları içine al.
update public.teklifler t
set crew_count = greatest(s.crew_min, least(s.crew_max, coalesce(t.crew_count, s.default_crew, 3)))
from public.services s
where s.name = t.type
  and s.active = true
  and s.crew_min is not null
  and s.crew_max is not null;

commit;
