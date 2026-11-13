-- REVIEW ONLY: apply through the approved migration process before releasing
-- schedule response writers. This extends Anastasis-only occurrence evidence;
-- no provider calendar rows, nutrition entries, health logs or streaks change.

alter table public.schedule_occurrence_checkoffs
  add column response_status text,
  add column occurrence_snapshot jsonb;

-- Existing boolean evidence keeps its exact outcome and completion timestamp.
update public.schedule_occurrence_checkoffs
  set response_status = case when completed then 'completed' else 'scheduled' end;

alter table public.schedule_occurrence_checkoffs
  alter column response_status set not null,
  add constraint schedule_occurrence_response_status_valid
    check (response_status in ('scheduled', 'in_progress', 'completed')),
  add constraint schedule_occurrence_response_completion_consistent
    check (completed = (response_status = 'completed')),
  add constraint schedule_occurrence_snapshot_object
    check (occurrence_snapshot is null or jsonb_typeof(occurrence_snapshot) = 'object');

-- Keep legacy boolean-only writers compatible during a rolling application
-- release. New writers always send both fields; conflicting intent is rejected.
create function public.normalize_schedule_occurrence_response()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'INSERT' and NEW.response_status is null then
    NEW.response_status := case when NEW.completed then 'completed' else 'scheduled' end;
  elsif TG_OP = 'UPDATE' and NEW.completed is distinct from OLD.completed
    and NEW.response_status is not distinct from OLD.response_status then
    NEW.response_status := case when NEW.completed then 'completed' else 'scheduled' end;
  end if;
  return NEW;
end;
$$;
revoke all on function public.normalize_schedule_occurrence_response() from public, anon, authenticated;
create trigger normalize_schedule_occurrence_response
  before insert or update on public.schedule_occurrence_checkoffs
  for each row execute function public.normalize_schedule_occurrence_response();

-- Existing ownership RLS, primary key, comparison revisions, grants and
-- deletion cascades are unchanged. No new role receives table privileges.
