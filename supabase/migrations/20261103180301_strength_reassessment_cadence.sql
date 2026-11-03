-- PREPARED ONLY: requires separate native review/approval before database apply.
-- Prerequisite: the existing owned atomic strength draft/completion function and
-- membership capabilities are installed. No schema/data/backfill changes.
-- Keep this unregistered until the native coordinator supplies the actual version.
-- Rollback: restore save_strength_assessment from the previously installed
-- 20261101170000_strength_assessment_drafts_atomic.sql; no records are deleted.
begin;
do $$ begin
  if to_regprocedure('public.save_strength_assessment(text,date,bigint,jsonb,boolean,jsonb)') is null then
    raise exception 'Install the existing strength assessment function first';
  end if;
end $$;

create or replace function public.save_strength_assessment(p_client_id text,p_period date,p_expected_revision bigint,p_values jsonb,p_complete boolean default false,p_program_json jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_user uuid:=(select auth.uid()); v_client public.clients%rowtype; v_session public.strength_assessment_sessions%rowtype;
  v_zone text; v_current date; v_now timestamptz:=clock_timestamp(); v_id uuid; v_count integer; v_newer_completed boolean:=false; v_eligible date;
begin
  if v_user is null then return jsonb_build_object('success',false,'status',401,'code','unauthorized'); end if;
  if p_period is null or extract(day from p_period)<>1 or p_expected_revision is null or p_expected_revision<0 or not public.valid_strength_assessment_values(p_values,coalesce(p_complete,false)) then return jsonb_build_object('success',false,'status',400,'code','validation'); end if;
  select * into v_client from public.clients where client_id=p_client_id and auth_user_id=v_user for update;
  if not found then return jsonb_build_object('success',false,'status',404,'code','not_found'); end if;
  -- Capture the final-write instant after any wait for the owner lock, so a
  -- final committed by its previous holder cannot fall beyond this read bound.
  v_now:=clock_timestamp();
  if public.member_has_capability(p_client_id,'assessmentsView') is distinct from true
    or (p_complete and p_program_json is not null and public.member_has_capability(p_client_id,'generatedCoaching') is distinct from true) then
    return jsonb_build_object('success',false,'status',403,'code','forbidden');
  end if;
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
    -- The client lock above serializes final submissions across draft periods.
    -- Draft saves never change this anchor; replay was handled before this gate.
    select ((max(a.submitted_at) at time zone v_zone)::date + interval '3 months')::date into v_eligible
      from public.assessments a where a.client_id=p_client_id and a.auth_user_id=v_user
      and a.assessment_type='strength' and a.submitted_at<=v_now;
    if v_eligible is not null and (v_now at time zone v_zone)::date<v_eligible then
      return jsonb_build_object('success',false,'status',409,'code','not_eligible','eligibleDate',v_eligible);
    end if;
    if not exists(select 1 from public.assessments a where a.client_id=p_client_id and a.auth_user_id=v_user and a.assessment_type='initial') then return jsonb_build_object('success',false,'status',409,'code','initial_required'); end if;
    if p_program_json is not null and jsonb_typeof(p_program_json)<>'object' then return jsonb_build_object('success',false,'status',400,'code','validation'); end if;
    select p_period<v_current or exists(select 1 from public.assessments a where a.client_id=p_client_id and a.auth_user_id=v_user and a.assessment_type='strength' and coalesce(a.assessment_period,date_trunc('month',a.submitted_at at time zone v_zone)::date)>p_period) into v_newer_completed;
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

commit;
