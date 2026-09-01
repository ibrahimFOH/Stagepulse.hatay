-- Teklif bazında ekip sayısını kalıcı ve yönetilebilir yap.
-- people/seyirci fiyat hesabına dahil değildir.
begin;

alter table public.teklifler
  add column if not exists crew_count integer;

-- Eski teklifler için hizmetin varsayılan ekip değerini doldur; hizmet bulunamazsa genel varsayılanı kullan.
update public.teklifler t
set crew_count = greatest(1, least(coalesce(s.default_crew, 3), 12))
from public.services s
where t.crew_count is null
  and s.name = t.type;

update public.teklifler
set crew_count = greatest(1, least(coalesce(crew_count, 3), 12))
where crew_count is null;

create index if not exists teklifler_crew_count_idx on public.teklifler(crew_count);

commit;
