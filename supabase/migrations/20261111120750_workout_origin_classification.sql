-- Existing rows stay NULL and keep their genuine legacy completion semantics.
-- Only future inserts receive this classification; no history is backfilled.
begin;

alter table public.workout_logs
  add column if not exists generated_origin_version smallint,
  add column if not exists generated_origin_transition jsonb;

alter table public.workout_logs
  alter column generated_origin_version set default 1;

-- Table-level INSERT/UPDATE grants also permit explicit NULL. Enforce the
-- classification independently of caller payloads, JSON markers and RPCs.
create or replace function public.guard_workout_origin_version()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  v_user uuid;
  v_client jsonb;
  v_now timestamptz := statement_timestamp();
  v_date date;
  v_state text;
  v_state_zone text;
  v_zone text;
  v_weekday text;
  v_count bigint;
  v_output_id text;
  v_output_at timestamptz;
  v_program jsonb;
  v_day jsonb;
begin
  if TG_OP = 'UPDATE' then
    -- Freeze both database-owned fields, including genuine legacy NULL.
    NEW.generated_origin_version := OLD.generated_origin_version;
    NEW.generated_origin_transition := OLD.generated_origin_transition;
    return NEW;
  end if;

  NEW.generated_origin_version := 1;
  NEW.generated_origin_transition := null;

  -- This is first-save evidence, not automatic completion or a legacy bypass.
  -- Readers must verify the complete generated/submitted prescription and dose
  -- and bind the receipt to the unchanged saved row before accepting its origin.
  begin
    v_user := auth.uid();
    if v_user is null or NEW.auth_user_id is distinct from v_user or
      NEW.workout_source is distinct from 'recommended' or NEW.id is null or
      NEW.workout_started_at is null or not isfinite(NEW.workout_started_at) or
      NEW.workout_started_at > v_now or nullif(btrim(NEW.day_name), '') is null then
      return NEW;
    end if;
    if jsonb_typeof(NEW.planned_exercises) is distinct from 'array' then return NEW; end if;
    if jsonb_array_length(NEW.planned_exercises) not between 1 and 100 then return NEW; end if;
    if exists (
      select 1 from jsonb_array_elements(NEW.planned_exercises) as exercises(item)
      where jsonb_typeof(item) is distinct from 'object' or item ? 'generated_workout_origin' or
        (item ? 'generated_workout_origin_status' and item->>'generated_workout_origin_status' is distinct from 'unsigned')
    ) then return NEW; end if;

    -- Use the same profile/state timezone fallback as save_daily_workout.
    select to_jsonb(c) into v_client from public.clients c
      where c.client_id = NEW.client_id and c.auth_user_id = v_user and c.program = NEW.program;
    if not found then return NEW; end if;
    v_state := upper(coalesce(nullif(btrim(v_client->>'state'), ''),
      nullif(btrim(v_client->'onboarding_data'->>'state'), ''), ''));
    v_state_zone := case
      when v_state = 'AK' then 'America/Anchorage'
      when v_state = 'AZ' then 'America/Phoenix'
      when v_state = 'HI' then 'Pacific/Honolulu'
      when v_state = 'IN' then 'America/Indiana/Indianapolis'
      when v_state in ('CA','NV','OR','WA') then 'America/Los_Angeles'
      when v_state in ('CO','ID','MT','NM','UT','WY') then 'America/Denver'
      when v_state in ('CT','DE','FL','GA','KY','MA','MD','ME','MI','NC','NH','NJ','NY','OH','PA','RI','SC','VA','VT','WV') then 'America/New_York'
      else 'America/Chicago' end;
    v_zone := coalesce(nullif(v_client->>'timezone', ''),
      nullif(v_client->'onboarding_data'->>'timezone', ''), v_state_zone);
    if not exists (select 1 from pg_catalog.pg_timezone_names where name = v_zone) then v_zone := v_state_zone; end if;
    v_date := (v_now at time zone v_zone)::date;
    if NEW.workout_date is distinct from v_date or
      (NEW.workout_started_at at time zone v_zone)::date is distinct from v_date then return NEW; end if;
    if to_regclass('public.program_outputs') is null then return NEW; end if;

    -- Choose the unique latest owned source before validating its timestamp or
    -- comparing any body. A later/incompatible output cannot expose an older
    -- convenient match as a substitute.
    with owned as (
      select p.id, p.generated_at, p.program_json from public.program_outputs p
      where p.client_id = NEW.client_id and p.program = NEW.program and
        (p.auth_user_id is null or p.auth_user_id = v_user)
    ), latest as (
      select * from owned where generated_at = (select max(generated_at) from owned)
    )
    select count(*), min(id::text), min(generated_at), jsonb_agg(program_json)->0
      into v_count, v_output_id, v_output_at, v_program from latest;
    if v_count <> 1 or v_output_id is null or v_output_at is null or
      not isfinite(v_output_at) or v_output_at > NEW.workout_started_at then return NEW; end if;
    if jsonb_typeof(v_program) is distinct from 'object' or
      jsonb_typeof(v_program->'days') is distinct from 'array' then return NEW; end if;
    v_weekday := (array['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'])[extract(dow from v_date)::integer + 1];
    select count(*), jsonb_agg(item)->0 into v_count, v_day
      from jsonb_array_elements(v_program->'days') as days(item)
      where jsonb_typeof(item) = 'object' and item->>'day_name' = v_weekday;
    if v_count <> 1 or jsonb_typeof(v_day->'exercises') is distinct from 'array' then return NEW; end if;
    if jsonb_array_length(v_day->'exercises') not between 1 and 100 then return NEW; end if;

    NEW.generated_origin_transition := jsonb_build_object(
      'version', 1, 'user_id', v_user, 'client_id', NEW.client_id, 'program', NEW.program,
      'local_date', v_date, 'timezone', v_zone, 'workout_log_id', NEW.id,
      'source_output_id', v_output_id, 'source_generated_at', v_output_at, 'captured_at', v_now,
      'generated_day', v_day, 'submitted_day_name', NEW.day_name,
      'submitted_prescription', NEW.planned_exercises);
  exception
    -- Optional evidence capture must not make actual-work logging depend on a
    -- missing/older source schema or permissions the caller does not possess.
    when undefined_table or undefined_column or undefined_function or datatype_mismatch or insufficient_privilege or data_exception then
      NEW.generated_origin_transition := null;
  end;
  return NEW;
end;
$$;

revoke all on function public.guard_workout_origin_version() from public;

drop trigger if exists workout_origin_version_guard on public.workout_logs;
create trigger workout_origin_version_guard
before insert or update on public.workout_logs
for each row execute function public.guard_workout_origin_version();

comment on column public.workout_logs.generated_origin_version is
  'NULL: preexisting legacy record. New inserts are classified 1 and every update preserves the existing classification, independently of supplied values or JSON metadata.';
comment on column public.workout_logs.generated_origin_transition is
  'Database-owned first-save candidate evidence for unsigned rollout sessions. Caller values are ignored and updates preserve it; full source/submitted identity and dose verification is required before linking completion.';

commit;
