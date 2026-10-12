-- Reviewable additive migration. Not applied to production.
-- Existing programs and legacy output JSON remain intact.
begin;

create table if not exists public.program_outputs (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(client_id),
  auth_user_id uuid references auth.users(id),
  program text not null,
  status text,
  program_json jsonb,
  generated_at timestamptz not null default now()
);
alter table public.program_outputs
  add column if not exists auth_user_id uuid references auth.users(id),
  add column if not exists program_json jsonb,
  add column if not exists status text;
alter table public.program_outputs enable row level security;
grant select, insert, update on public.program_outputs to authenticated;

-- Restrictive ownership applies even when a previous deployment has broader policies.
create policy "member program ownership boundary" on public.program_outputs
  as restrictive for all to authenticated
  using (exists (
    select 1 from public.clients c
    where c.client_id = program_outputs.client_id
      and c.auth_user_id = (select auth.uid())
      and (program_outputs.auth_user_id is null or program_outputs.auth_user_id = (select auth.uid()))
  ))
  with check (program_outputs.auth_user_id = (select auth.uid()) and exists (
    select 1 from public.clients c
    where c.client_id = program_outputs.client_id
      and c.auth_user_id = (select auth.uid())
      and c.program = program_outputs.program
      and c.access is true and c.active is true
  ));
create policy "members read saved programs" on public.program_outputs
  for select to authenticated using (true);
create policy "members save own programs" on public.program_outputs
  for insert to authenticated with check (true);
create policy "members update own programs" on public.program_outputs
  for update to authenticated using (true) with check (true);

commit;

-- Additive replacement; apply after 20261009004035_coordinated_daily_dashboard.sql.
-- The function retains prior same-day sessions when the exercise identities change.
-- No existing workout rows are changed by applying this definition.
create or replace function public.save_daily_workout(p_client_id text, p_day_start timestamptz, p_day_end timestamptz, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_id uuid; v_log public.workout_logs%rowtype; v_program text; v_keys jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select program into v_program from public.clients where client_id = p_client_id and auth_user_id = auth.uid() for update;
  if not found then raise exception 'Client not found'; end if;
  if p_payload->>'program' is distinct from v_program then raise exception 'Workout does not match your program'; end if;
  if p_day_end <= p_day_start or (p_payload->>'workout_date')::timestamptz < p_day_start or (p_payload->>'workout_date')::timestamptz >= p_day_end then raise exception 'Session date outside local day'; end if;
  if jsonb_typeof(p_payload->'exercise_logs') is distinct from 'array' or jsonb_array_length(p_payload->'exercise_logs') not between 1 and 100 then raise exception 'Invalid exercises'; end if;
  select jsonb_agg(coalesce(item->>'session_key', coalesce(item->>'id',item->>'exercise',item->>'name') || ':' || (position-1)::text) order by position)
    into v_keys from jsonb_array_elements(p_payload->'exercise_logs') with ordinality as exercises(item,position);
  select id into v_id from public.workout_logs where client_id = p_client_id and auth_user_id = auth.uid()
    and day_name = p_payload->>'day_name' and workout_source = p_payload->>'workout_source'
    and workout_date >= p_day_start and workout_date < p_day_end
    and (select jsonb_agg(coalesce(item->>'session_key', coalesce(item->>'id',item->>'exercise',item->>'name') || ':' || (position-1)::text) order by position)
      from jsonb_array_elements(coalesce(exercise_logs,'[]'::jsonb)) with ordinality as exercises(item,position)) is not distinct from v_keys
    order by workout_date desc limit 1;
  if v_id is null then
    insert into public.workout_logs(client_id,auth_user_id,program,day_name,workout_source,workout_date,planned_exercises,exercise_logs,completed,updated_at)
      values(p_client_id,auth.uid(),v_program,p_payload->>'day_name',p_payload->>'workout_source',(p_payload->>'workout_date')::timestamptz,p_payload->'planned_exercises',p_payload->'exercise_logs',(p_payload->>'completed')::boolean,now()) returning * into v_log;
  else
    update public.workout_logs set planned_exercises = p_payload->'planned_exercises', exercise_logs = p_payload->'exercise_logs',
      completed = (p_payload->>'completed')::boolean, updated_at = now()
      where id = v_id and auth_user_id = auth.uid() returning * into v_log;
  end if;
  return to_jsonb(v_log);
end $$;
revoke all on function public.save_daily_workout(text,timestamptz,timestamptz,jsonb) from public, anon;
grant execute on function public.save_daily_workout(text,timestamptz,timestamptz,jsonb) to authenticated;
