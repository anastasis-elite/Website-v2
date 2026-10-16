-- Additive: legacy completed assessments and their original dates remain unchanged.
alter table public.assessments add column if not exists assessment_period date;
create index if not exists strength_history_owner_period_idx on public.assessments(auth_user_id,client_id,assessment_period,submitted_at) where assessment_type='strength';
create index if not exists strength_history_owner_date_idx on public.assessments(auth_user_id,client_id,submitted_at desc) where assessment_type='strength';

create table if not exists public.strength_assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(client_id),
  auth_user_id uuid not null references auth.users(id),
  period date not null check (extract(day from period)=1),
  status text not null default 'draft' check (status in ('draft','completed')),
  values jsonb not null default '{}',
  revision bigint not null default 1 check (revision>0),
  saved_at timestamptz not null default now(),
  completed_at timestamptz,
  assessment_id uuid references public.assessments(id),
  unique(auth_user_id,period),
  check ((status='draft' and completed_at is null and assessment_id is null) or (status='completed' and completed_at is not null and assessment_id is not null))
);
alter table public.strength_assessment_sessions enable row level security;
revoke all on public.strength_assessment_sessions from public,anon,authenticated;
grant select,insert,update on public.strength_assessment_sessions to authenticated;
grant all on public.strength_assessment_sessions to service_role;
drop policy if exists "members read own strength sessions" on public.strength_assessment_sessions;
create policy "members read own strength sessions" on public.strength_assessment_sessions for select to authenticated
  using(auth_user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=strength_assessment_sessions.client_id and c.auth_user_id=(select auth.uid())));
drop policy if exists "members insert own strength sessions" on public.strength_assessment_sessions;
create policy "members insert own strength sessions" on public.strength_assessment_sessions for insert to authenticated
  with check(auth_user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=strength_assessment_sessions.client_id and c.auth_user_id=(select auth.uid())));
drop policy if exists "members update own strength drafts" on public.strength_assessment_sessions;
create policy "members update own strength drafts" on public.strength_assessment_sessions for update to authenticated
  using(auth_user_id=(select auth.uid()) and status='draft' and exists(select 1 from public.clients c where c.client_id=strength_assessment_sessions.client_id and c.auth_user_id=(select auth.uid())))
  with check(auth_user_id=(select auth.uid()) and exists(select 1 from public.clients c where c.client_id=strength_assessment_sessions.client_id and c.auth_user_id=(select auth.uid())));

create or replace function public.valid_strength_assessment_values(p_values jsonb,p_complete boolean)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare k text; v jsonb; lift text; w text; r text;
begin
  if p_values is null or jsonb_typeof(p_values)<>'object' or octet_length(p_values::text)>16000 then return false; end if;
  for k,v in select * from jsonb_each(p_values) loop
    if not (k=any(array['birthdate','height_in','weight','weight_goal','training_environment','plank_time','notes','shoulder_press_weight','shoulder_press_reps','squat_weight','squat_reps','bench_press_weight','bench_press_reps','close_grip_press_weight','close_grip_press_reps','romanian_deadlift_weight','romanian_deadlift_reps','seated_row_weight','seated_row_reps','bicep_curl_weight','bicep_curl_reps','lateral_raise_weight','lateral_raise_reps'])) or jsonb_typeof(v)<>'string' or length(v#>>'{}')>(case when k='notes' then 5000 else 100 end) then return false; end if;
  end loop;
  if not p_complete then return true; end if;
  if nullif(btrim(p_values->>'weight'),'') is null or nullif(btrim(p_values->>'height_in'),'') is null then return false; end if;
  if not ((p_values->>'weight')::numeric>0 and (p_values->>'weight')::numeric<=1500 and (p_values->>'height_in')::numeric>0 and (p_values->>'height_in')::numeric<=120) then return false; end if;
  foreach lift in array array['shoulder_press','squat','bench_press','close_grip_press','romanian_deadlift','seated_row','bicep_curl','lateral_raise'] loop
    w:=nullif(btrim(p_values->>(lift||'_weight')),''); r:=nullif(btrim(p_values->>(lift||'_reps')),'');
    if w is not null or r is not null then
      if w is null or r is null or not (w::numeric>=0 and w::numeric<=3000 and r::numeric>=1 and r::numeric<=100 and trunc(r::numeric)=r::numeric) then return false; end if;
    end if;
  end loop;
  w:=nullif(btrim(p_values->>'plank_time'),'');
  if w is not null and not (w::numeric>=0 and w::numeric<=86400) then return false; end if;
  return true;
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end $$;
revoke all on function public.valid_strength_assessment_values(jsonb,boolean) from public,anon;
grant execute on function public.valid_strength_assessment_values(jsonb,boolean) to authenticated,service_role;

-- Keep database month boundaries identical to the verified client timezone rules.
create or replace function public.strength_assessment_timezone(p_client_id text)
returns text language plpgsql stable security invoker set search_path='' as $$
declare v_client public.clients%rowtype; v_zone text; v_state text;
begin
  select * into v_client from public.clients where client_id=p_client_id and auth_user_id=(select auth.uid());
  v_zone:=coalesce(nullif(v_client.timezone,''),nullif(v_client.onboarding_data->>'timezone',''));
  v_state:=upper(btrim(coalesce(nullif(v_client.state,''),v_client.onboarding_data->>'state','')));
  if v_zone is not null then
    select name into v_zone from pg_catalog.pg_timezone_names where lower(name)=lower(v_zone) limit 1;
    if found then return v_zone; end if;
  end if;
  return case when v_state=any(array['CA','NV','OR','WA']) then 'America/Los_Angeles' when v_state=any(array['CO','MT','NM','UT','WY']) then 'America/Denver' when v_state='ID' then 'America/Boise' when v_state='AZ' then 'America/Phoenix' when v_state='AK' then 'America/Anchorage' when v_state='HI' then 'Pacific/Honolulu' when v_state='IN' then 'America/Indiana/Indianapolis' when v_state='MI' then 'America/Detroit' when v_state=any(array['CT','DE','FL','GA','KY','MA','MD','ME','NC','NH','NJ','NY','OH','PA','RI','SC','VA','VT','WV']) then 'America/New_York' else 'America/Chicago' end;
end $$;
revoke all on function public.strength_assessment_timezone(text) from public,anon;
grant execute on function public.strength_assessment_timezone(text) to authenticated,service_role;

-- Even direct Data API writes cannot rewrite completed sessions or forge completion
-- without an identical, owner-scoped, final history record for that month.
create or replace function public.guard_strength_assessment_session()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if not public.valid_strength_assessment_values(new.values,new.status='completed') then raise exception 'Invalid strength assessment values' using errcode='22023'; end if;
  if tg_op='UPDATE' then
    if old.status='completed' or (new.client_id,new.auth_user_id,new.period,new.id) is distinct from (old.client_id,old.auth_user_id,old.period,old.id) then raise exception 'Completed strength assessments are immutable' using errcode='42501'; end if;
    new.revision:=old.revision+1;
  else
    if current_user='authenticated' and new.period<>date_trunc('month',clock_timestamp() at time zone public.strength_assessment_timezone(new.client_id))::date then raise exception 'New strength assessment month changed' using errcode='22023'; end if;
    new.revision:=1;
  end if;
  new.saved_at:=clock_timestamp();
  if new.status='completed' then
    if not exists(select 1 from public.assessments a where a.id=new.assessment_id and a.auth_user_id=new.auth_user_id and a.client_id=new.client_id and a.assessment_type='strength' and a.assessment_period=new.period and a.data=new.values and a.submitted_at=new.completed_at) then raise exception 'Strength completion is not confirmed' using errcode='42501'; end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_strength_assessment_session() from public,anon,authenticated;
drop trigger if exists strength_assessment_session_guard on public.strength_assessment_sessions;
create trigger strength_assessment_session_guard before insert or update on public.strength_assessment_sessions for each row execute function public.guard_strength_assessment_session();

create or replace function public.save_strength_assessment(p_client_id text,p_period date,p_expected_revision bigint,p_values jsonb,p_complete boolean default false,p_program_json jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_user uuid:=(select auth.uid()); v_client public.clients%rowtype; v_session public.strength_assessment_sessions%rowtype;
  v_zone text; v_current date; v_now timestamptz:=clock_timestamp(); v_id uuid; v_count integer; v_newer_completed boolean:=false;
begin
  if v_user is null then return jsonb_build_object('success',false,'status',401,'code','unauthorized'); end if;
  if p_period is null or extract(day from p_period)<>1 or p_expected_revision is null or p_expected_revision<0 or not public.valid_strength_assessment_values(p_values,coalesce(p_complete,false)) then return jsonb_build_object('success',false,'status',400,'code','validation'); end if;
  select * into v_client from public.clients where client_id=p_client_id and auth_user_id=v_user for update;
  if not found then return jsonb_build_object('success',false,'status',404,'code','not_found'); end if;
  v_zone:=public.strength_assessment_timezone(p_client_id);
  v_current:=date_trunc('month',v_now at time zone v_zone)::date;
  select * into v_session from public.strength_assessment_sessions where client_id=p_client_id and auth_user_id=v_user and period=p_period;
  if found and v_session.status='completed' then
    if p_complete and v_session.values=p_values then return jsonb_build_object('success',true,'alreadyCompleted',true,'assessment',to_jsonb(v_session)); end if;
    return jsonb_build_object('success',false,'status',409,'code','conflict','assessment',to_jsonb(v_session));
  end if;
  -- Legacy evidence wins without relabeling, deleting or inserting historical rows.
  if exists(select 1 from public.assessments a where a.client_id=p_client_id and a.auth_user_id=v_user and a.assessment_type='strength' and coalesce(a.assessment_period,date_trunc('month',a.submitted_at at time zone v_zone)::date)=p_period) then
    return jsonb_build_object('success',false,'status',409,'code','already_completed');
  end if;
  if v_session.id is null and p_period<>v_current then return jsonb_build_object('success',false,'status',409,'code','period_changed','currentPeriod',v_current); end if;
  if p_period>v_current then return jsonb_build_object('success',false,'status',409,'code','period_changed','currentPeriod',v_current); end if;
  if coalesce(v_session.revision,0)<>p_expected_revision then return jsonb_build_object('success',false,'status',409,'code','conflict','assessment',case when v_session.id is null then null else to_jsonb(v_session) end); end if;
  if p_complete then
    if not exists(select 1 from public.assessments a where a.client_id=p_client_id and a.auth_user_id=v_user and a.assessment_type='initial') then return jsonb_build_object('success',false,'status',409,'code','initial_required'); end if;
    if p_program_json is not null and jsonb_typeof(p_program_json)<>'object' then return jsonb_build_object('success',false,'status',400,'code','validation'); end if;
    select exists(select 1 from public.assessments a where a.client_id=p_client_id and a.auth_user_id=v_user and a.assessment_type='strength' and coalesce(a.assessment_period,date_trunc('month',a.submitted_at at time zone v_zone)::date)>p_period) into v_newer_completed;
    insert into public.assessments(client_id,auth_user_id,program,assessment_type,data,source,submitted_at,assessment_period)
      values(p_client_id,v_user,v_client.program,'strength',p_values,'strength-assessment',v_now,p_period) returning id into v_id;
    if not v_newer_completed then
    insert into public.client_current_profiles(client_id,user_id,current_weight,updated_at) values(p_client_id,v_user,(p_values->>'weight')::numeric,v_now)
      on conflict(client_id) do update set current_weight=excluded.current_weight,updated_at=excluded.updated_at where public.client_current_profiles.user_id=v_user;
    get diagnostics v_count=row_count;
    if v_count<>1 then raise exception 'Strength profile ownership changed' using errcode='42501'; end if;
    if p_program_json is not null then
      insert into public.program_outputs(client_id,auth_user_id,program,status,program_json,generated_at) values(p_client_id,v_user,v_client.program,'generated',p_program_json,v_now);
    end if;
    end if;
  end if;
  if v_session.id is null then
    insert into public.strength_assessment_sessions(client_id,auth_user_id,period,status,values,completed_at,assessment_id)
      values(p_client_id,v_user,p_period,case when p_complete then 'completed' else 'draft' end,p_values,case when p_complete then v_now end,v_id) returning * into v_session;
  else
    update public.strength_assessment_sessions set values=p_values,status=case when p_complete then 'completed' else 'draft' end,completed_at=case when p_complete then v_now end,assessment_id=v_id where id=v_session.id and revision=p_expected_revision returning * into v_session;
    if not found then raise exception 'Strength draft ownership changed' using errcode='42501'; end if;
  end if;
  return jsonb_build_object('success',true,'preservedNewerResults',v_newer_completed,'assessment',to_jsonb(v_session));
end $$;
revoke all on function public.save_strength_assessment(text,date,bigint,jsonb,boolean,jsonb) from public,anon,service_role;
grant execute on function public.save_strength_assessment(text,date,bigint,jsonb,boolean,jsonb) to authenticated;
