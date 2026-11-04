-- PREPARED ONLY: not registered or applied. No member rows, grants, RLS or tables change.
-- Prerequisites: current membership capabilities, strength_assessment_timezone,
-- and the existing owner-scoped clients JSON compare-and-swap API.
-- Install before enabling weekday preference writes. Existing keys require review;
-- this preparation deliberately does not bless, rewrite or backfill any value.
-- Compatibility: unrelated onboarding_data edits and exact no-op retries pass.
-- Rollback after disabling the preference write surface: drop the trigger, then
-- guard_weekday_muscle_preferences().
-- Keep saved JSON intact. Rolling back the guard while writes remain enabled is unsafe.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $preconditions$ begin
 if to_regclass('public.clients') is null
   or to_regprocedure('public.member_has_capability(text,text)') is null
   or to_regprocedure('public.strength_assessment_timezone(text)') is null then
  raise exception 'Weekday preference ownership, capability and timezone prerequisites are absent' using errcode='55000';
 end if;
end $preconditions$;
-- Hold the same bounded table lock through preflight and trigger installation,
-- so a concurrent direct write cannot introduce an unguarded preference key.
lock table public.clients in share row exclusive mode;
do $existing_keys$ begin
 if not exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.clients'::regclass and tgname='guard_weekday_muscle_preferences')
   and exists(select 1 from public.clients where onboarding_data ? 'weekdayMusclePreferences') then
  raise exception 'Existing weekday preferences require review before enabling the guard' using errcode='55000';
 end if;
end $existing_keys$;

create or replace function public.guard_weekday_muscle_preferences()
returns trigger language plpgsql security invoker set search_path='' as $$
declare previous jsonb; proposed jsonb; pending jsonb; receipt jsonb; expected_current jsonb='null';
 previous_revision bigint=0; local_today date; next_monday date; saved_at timestamptz; operation_id text;
 choice jsonb; day text; groups jsonb; group_value jsonb; seen text[]='{}'; has_group boolean=false;
 group_position integer; last_position integer; group_order text[]=array[
  'neck','upper_traps','shoulders','chest','upper_back','lats','rhomboids','biceps','triceps','forearms',
  'lower_back','core','glutes','hip_flexors','quads','hamstrings','adductors','calves','feet_ankles'];
begin
 if tg_op='INSERT' then
  if new.onboarding_data ? 'weekdayMusclePreferences' then
   raise exception 'Save weekday preferences after the owned profile exists' using errcode='42501';
  end if;
  return new;
 end if;
 previous=old.onboarding_data->'weekdayMusclePreferences';
 proposed=new.onboarding_data->'weekdayMusclePreferences';
 if proposed is not distinct from previous then return new; end if;
 if (new.timezone,new.state,new.onboarding_data->'timezone',new.onboarding_data->'state')
   is distinct from (old.timezone,old.state,old.onboarding_data->'timezone',old.onboarding_data->'state') then
  raise exception 'Change timezone separately before reviewing weekday preferences' using errcode='22023';
 end if;
 if auth.uid() is null or old.auth_user_id is distinct from auth.uid()
   or (new.client_id,new.auth_user_id) is distinct from (old.client_id,old.auth_user_id)
   or public.member_has_capability(old.client_id,'generatedCoaching') is distinct from true
   or public.member_has_capability(old.client_id,'workoutDisplay') is distinct from true then
  raise exception 'Owned guided workout membership required' using errcode='42501';
 end if;
 -- This existing helper reads the OLD owned profile with the same canonical
 -- timezone/state fallback as strength scheduling. A simultaneous JSON timezone
 -- edit cannot choose an earlier effective date for this preference transition.
 local_today=(clock_timestamp() at time zone public.strength_assessment_timezone(old.client_id))::date;
 next_monday=date_trunc('week',local_today::timestamp)::date+7;
 if jsonb_typeof(proposed) is distinct from 'object'
   or proposed-array['version','revision','current','pending','lastOperation']<>'{}'::jsonb
   or proposed->'version' is distinct from '1'::jsonb
   or jsonb_typeof(proposed->'revision') is distinct from 'number'
   or coalesce(proposed->>'revision','') !~ '^[1-9][0-9]{0,15}$'
   or (proposed->>'revision')::numeric>9007199254740991 then
  raise exception 'Invalid weekday preference state' using errcode='22023';
 end if;
 if previous is not null then
  if jsonb_typeof(previous) is distinct from 'object' or previous->'version' is distinct from '1'::jsonb
    or coalesce(previous->>'revision','') !~ '^[1-9][0-9]{0,15}$'
    or (previous->>'revision')::numeric>9007199254740991
    or jsonb_typeof(previous->'pending') is distinct from 'object' then
   raise exception 'Existing weekday preferences require review' using errcode='22023';
  end if;
  previous_revision=(previous->>'revision')::bigint;
  if (previous#>>'{pending,effectiveDate}')::date<=local_today then expected_current=previous->'pending';
  else expected_current=coalesce(previous->'current','null'::jsonb); end if;
 end if;
 if (proposed->>'revision')::bigint<>previous_revision+1
   or proposed->'current' is distinct from expected_current then
  raise exception 'Weekday preferences changed; reload before saving' using errcode='40001';
 end if;
 pending=proposed->'pending'; receipt=proposed->'lastOperation';
 if jsonb_typeof(pending) is distinct from 'object'
   or pending-array['choice','effectiveDate','savedAt','operationId']<>'{}'::jsonb
   or pending->>'effectiveDate' is distinct from to_char(next_monday,'YYYY-MM-DD')
   or jsonb_typeof(receipt) is distinct from 'object'
   or receipt-array['id','expectedRevision','requestedDate','choice']<>'{}'::jsonb
   or receipt->'choice' is distinct from pending->'choice'
   or receipt->'expectedRevision' is distinct from to_jsonb(previous_revision)
   or receipt->>'requestedDate' is distinct from to_char(local_today,'YYYY-MM-DD') then
  raise exception 'Weekday preferences must begin next local Monday' using errcode='22023';
 end if;
 choice=pending->'choice';
 if jsonb_typeof(choice) is distinct from 'object' then
  raise exception 'Invalid weekday muscle choice' using errcode='22023';
 end if;
 if choice->>'mode'='program_default' then
  if choice<>'{"mode":"program_default"}'::jsonb then raise exception 'Invalid weekday muscle choice' using errcode='22023'; end if;
 else
  if choice->>'mode' is distinct from 'custom' or choice-array['mode','days']<>'{}'::jsonb
    or jsonb_typeof(choice->'days') is distinct from 'object'
    or (select count(*) from jsonb_object_keys(choice->'days'))<>7 then
   raise exception 'Invalid weekday muscle choice' using errcode='22023';
  end if;
  foreach day in array array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] loop
   groups=choice->'days'->day;
   last_position=0;
   if jsonb_typeof(groups) is distinct from 'array' or jsonb_array_length(groups)>19 then raise exception 'Invalid weekday muscle choice' using errcode='22023'; end if;
   for group_value in select value from jsonb_array_elements(groups) loop
    group_position=array_position(group_order,group_value#>>'{}');
    if jsonb_typeof(group_value) is distinct from 'string' or group_position is null
      or group_position<=last_position or (group_value#>>'{}')=any(seen) then raise exception 'Invalid weekday muscle choice' using errcode='22023'; end if;
    -- Match parseWeekdayMuscleChoice ordering, so a direct accepted value can
    -- later be promoted verbatim by the API without changing current identity.
    last_position=group_position;
    seen=array_append(seen,group_value#>>'{}'); has_group=true;
   end loop;
  end loop;
  if not has_group then raise exception 'Invalid weekday muscle choice' using errcode='22023'; end if;
 end if;
 operation_id=pending->>'operationId';
 if coalesce(operation_id,'') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or receipt->>'id' is distinct from operation_id
   or operation_id is not distinct from previous#>>'{lastOperation,id}'
   or coalesce(pending->>'savedAt','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' then
  raise exception 'Invalid weekday preference receipt' using errcode='22023';
 end if;
 saved_at=(pending->>'savedAt')::timestamptz;
 if not isfinite(saved_at) or saved_at<clock_timestamp()-interval '5 minutes' or saved_at>clock_timestamp()+interval '5 minutes' then
  raise exception 'Weekday preference save time changed; reload' using errcode='22023';
 end if;
 return new;
end $$;
revoke all on function public.guard_weekday_muscle_preferences() from public,anon,authenticated;
create or replace trigger guard_weekday_muscle_preferences
 before insert or update on public.clients for each row execute function public.guard_weekday_muscle_preferences();
commit;
