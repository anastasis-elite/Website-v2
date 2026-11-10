-- Add catalog concepts only; existing catalog IDs and symptom history are retained.
-- Serialize the small insert because symptom_types does not require unique names.
begin;
lock table public.symptom_types in share row exclusive mode;

insert into public.symptom_types (name)
select additions.name
from (values
  ('Menstrual Cramps'),
  ('Pelvic Pain'),
  ('Breast Tenderness'),
  ('Lower Back Pain')
) as additions(name)
where not exists (
  select 1
  from public.symptom_types existing
  where btrim(regexp_replace(lower(existing.name), '[^a-z0-9]+', ' ', 'g'))
      = btrim(regexp_replace(lower(additions.name), '[^a-z0-9]+', ' ', 'g'))
);
commit;
