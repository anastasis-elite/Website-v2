alter table public.cycle_logs add column if not exists answered_fields text[];
-- Additive: retain all existing logs, dates, RLS, and tier policies.
-- Water submissions are serialized on the daily log; retries never add the same drink twice.
alter table public.nutrition_logs add column if not exists water_submission_ids uuid[] not null default '{}';

create or replace function public.add_daily_water(p_log_id uuid, p_ounces numeric, p_submission_id uuid)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_log public.nutrition_logs%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_submission_id is null or p_ounces is null or p_ounces <= 0 or p_ounces::text in ('NaN','Infinity','-Infinity') then raise exception 'Enter a valid water amount'; end if;
  select * into v_log from public.nutrition_logs where id = p_log_id and auth_user_id = auth.uid() for update;
  if not found then raise exception 'Nutrition log not found'; end if;
  if p_submission_id = any(v_log.water_submission_ids) then return to_jsonb(v_log); end if;
  update public.nutrition_logs set water_consumed_oz = coalesce(water_consumed_oz, 0) + p_ounces,
    water_submission_ids = array_append(water_submission_ids, p_submission_id), updated_at = now()
    where id = p_log_id and auth_user_id = auth.uid() returning * into v_log;
  return to_jsonb(v_log);
end $$;
revoke all on function public.add_daily_water(uuid,numeric,uuid) from public, anon;
grant execute on function public.add_daily_water(uuid,numeric,uuid) to authenticated;

-- Both statements run in one transaction: invalid inserts restore the original commitments.
create or replace function public.replace_daily_commitments(p_client_id text, p_blocks jsonb)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform 1 from public.clients where client_id = p_client_id and auth_user_id = auth.uid() for update;
  if not found then raise exception 'Client not found'; end if;
  if jsonb_typeof(p_blocks) <> 'array' or jsonb_array_length(p_blocks) > 100 then raise exception 'Invalid commitments'; end if;
  delete from public.client_schedule_blocks where client_id = p_client_id and user_id = auth.uid();
  insert into public.client_schedule_blocks(user_id,client_id,block_type,label,days_of_week,start_time,end_time,active)
    select auth.uid(), p_client_id, block_type, label, days_of_week, start_time::time, end_time::time, true
    from jsonb_to_recordset(p_blocks) as x(block_type text,label text,days_of_week smallint[],start_time text,end_time text);
end $$;
revoke all on function public.replace_daily_commitments(text,jsonb) from public, anon;
grant execute on function public.replace_daily_commitments(text,jsonb) to authenticated;

create or replace function public.save_daily_workout(p_client_id text, p_day_start timestamptz, p_day_end timestamptz, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_id uuid; v_log public.workout_logs%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform 1 from public.clients where client_id = p_client_id and auth_user_id = auth.uid() for update;
  if not found then raise exception 'Client not found'; end if;
  if (p_payload->>'workout_date')::timestamptz < p_day_start or (p_payload->>'workout_date')::timestamptz >= p_day_end then raise exception 'Session date outside local day'; end if;
  select id into v_id from public.workout_logs where client_id = p_client_id and auth_user_id = auth.uid()
    and day_name = p_payload->>'day_name' and workout_source = p_payload->>'workout_source'
    and workout_date >= p_day_start and workout_date < p_day_end order by workout_date desc limit 1;
  if v_id is null then
    insert into public.workout_logs(client_id,auth_user_id,program,day_name,workout_source,workout_date,planned_exercises,exercise_logs,completed,updated_at)
      values(p_client_id,auth.uid(),p_payload->>'program',p_payload->>'day_name',p_payload->>'workout_source',(p_payload->>'workout_date')::timestamptz,p_payload->'planned_exercises',p_payload->'exercise_logs',(p_payload->>'completed')::boolean,now()) returning * into v_log;
  else
    update public.workout_logs set planned_exercises = p_payload->'planned_exercises', exercise_logs = p_payload->'exercise_logs',
      completed = (p_payload->>'completed')::boolean, updated_at = now()
      where id = v_id and auth_user_id = auth.uid() returning * into v_log;
  end if;
  return to_jsonb(v_log);
end $$;
revoke all on function public.save_daily_workout(text,timestamptz,timestamptz,jsonb) from public, anon;
grant execute on function public.save_daily_workout(text,timestamptz,timestamptz,jsonb) to authenticated;

-- Editing confirmed sets cannot leave a session empty after an insert failure.
create or replace function public.replace_workout_sets(p_session_id uuid, p_sets jsonb)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_session public.workout_exercise_sessions%rowtype;
begin
  select * into v_session from public.workout_exercise_sessions where id = p_session_id and auth_user_id = auth.uid() for update;
  if not found then raise exception 'Session not found'; end if;
  if jsonb_typeof(p_sets) <> 'array' or jsonb_array_length(p_sets)>100 then raise exception 'Invalid sets'; end if;
  delete from public.workout_exercise_sets where exercise_session_id = p_session_id;
  insert into public.workout_exercise_sets(workout_log_id,exercise_session_id,exercise_id,set_number,weight,weight_unit,reps,set_started_at,completed_at)
    select v_session.workout_log_id,p_session_id,v_session.exercise_id,set_number,weight,weight_unit,reps,set_started_at,completed_at
    from jsonb_to_recordset(p_sets) as x(set_number int,weight numeric,weight_unit text,reps int,set_started_at timestamptz,completed_at timestamptz);
end $$;
revoke all on function public.replace_workout_sets(uuid,jsonb) from public, anon;
grant execute on function public.replace_workout_sets(uuid,jsonb) to authenticated;
