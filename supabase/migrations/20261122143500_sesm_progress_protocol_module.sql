-- OSC / MIDI protokol modülünü üretim veritabanındaki ilerleme sözleşmesine ekle.
-- Mevcut öğrenci ilerleme kayıtları korunur.
alter table public.sesm_progress
  drop constraint if exists sesm_progress_module_id_check;

alter table public.sesm_progress
  add constraint sesm_progress_module_id_check
  check (module_id = any (array[
    'frequency'::text,
    'ear'::text,
    'calculators'::text,
    'protocol'::text,
    'acoustics'::text,
    'rta'::text,
    'mixer'::text,
    'wav'::text,
    'lufs'::text,
    'cues'::text,
    'checklists'::text,
    'docs'::text
  ]));
