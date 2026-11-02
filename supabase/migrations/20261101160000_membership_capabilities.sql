-- Prepared only. Canonical membership authorization; historical owner SELECT policies remain intact.
begin;
do $community_dependency$ begin
 if to_regnamespace('community_private') is null
   or to_regclass('public.community_posts') is null
   or to_regclass('public.community_reports') is null
   or to_regclass('public.community_cleanup_holds') is null
   or to_regprocedure('community_private.has_member_access()') is null
   or to_regprocedure('community_private.current_author_held()') is null
   or to_regprocedure('community_private.guard_post_cleanup()') is null
   or to_regprocedure('community_private.guard_report_cleanup()') is null then
  raise exception 'Community foundation and operations must be installed before membership capabilities' using errcode='55000';
 end if;
end $community_dependency$;
create schema if not exists membership_private;
revoke all on schema membership_private from public, anon;
grant usage on schema membership_private to authenticated;

create or replace function membership_private.has_capability(p_client_id text, p_capability text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare c public.clients%rowtype; t text; valid_until timestamptz;
begin
  if auth.uid() is null or p_client_id is null or p_capability is null then return false; end if;
  select * into c from public.clients where client_id=p_client_id and auth_user_id=auth.uid();
  if not found then return false; end if;
  t=lower(c.program);
  if t is null or t not in ('free','tracker','ember','ignite','phoenix') then return false; end if;
  if p_capability='accountData' then return true; end if;
  if not exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null) then return false; end if;
  if c.access is distinct from true or c.active is false then return false; end if;
  if membership_private.expiry_is_current(to_jsonb(c),now()) is distinct from true then return false; end if;
  if p_capability='community' then return true; end if;
  if p_capability='phoenixTasks' then return t='phoenix'; end if;
  if t='free' then return false; end if;
  if p_capability in ('workoutLogging','workoutDisplay','healthRecords','nutritionTracking','recoveryBasic','progressView') then return true; end if;
  if t='tracker' then return p_capability='nutritionMacroEntry'; end if;
  if p_capability in ('generatedCoaching','calendar','whatsNext','workoutDisplay','assessmentPhotoUpload','assessmentsView','trendsView','recipeFavorites') then return true; end if;
  if p_capability='nutritionMacroEntry' then return t='ember'; end if;
  if p_capability in ('nutritionMealLogging','nutritionBarcodeScanning','nutritionMicronutrients','nutritionRecurringFoodDetection','nutritionAutomaticPreLogging','postureAssessment','recoveryRecommendation') then return t in ('ignite','phoenix'); end if;
  if p_capability in ('nutritionRecommendedMeal','recoveryDirectedNextAction') then return t='phoenix'; end if;
  return false;
end $$;
revoke all on function membership_private.has_capability(text,text) from public,anon,authenticated;
grant execute on function membership_private.has_capability(text,text) to authenticated;
create or replace function public.member_has_capability(p_client_id text,p_capability text)
returns boolean language sql stable security invoker set search_path='' as $$select membership_private.has_capability(p_client_id,p_capability)$$;
revoke all on function public.member_has_capability(text,text) from public,anon,authenticated;
grant execute on function public.member_has_capability(text,text) to authenticated;

-- Existing nutrition mutation policies retain their explicit tier arrays. Route
-- their legacy helper through the same exact-expiry policy as other member APIs.
create or replace function public.member_has_nutrition_access(p_client_id text,p_tiers text[])
returns boolean language sql stable security invoker set search_path=public,pg_temp as $$
 select exists(select 1 from public.clients c
   where c.client_id=p_client_id and c.auth_user_id=(select auth.uid())
     and lower(c.program)=any(p_tiers)
     and public.member_has_capability(c.client_id,'nutritionTracking') is true)
$$;
revoke all on function public.member_has_nutrition_access(text,text[]) from public,anon,authenticated,service_role;
grant execute on function public.member_has_nutrition_access(text,text[]) to authenticated;

-- Extend only single-column program checks, preserving their existing paid values.
do $$ declare r record; expression text; begin
 for r in select con.conname,pg_get_constraintdef(con.oid) definition from pg_constraint con join pg_attribute a on a.attrelid=con.conrelid and a.attnum=con.conkey[1]
   where con.conrelid='public.clients'::regclass and con.contype='c' and cardinality(con.conkey)=1 and a.attname='program' loop
   expression=substring(r.definition from '^CHECK \((.*)\)$');
   if expression is null then raise exception 'Review the program constraint before extending membership'; end if;
   execute format('alter table public.clients drop constraint %I',r.conname);
   execute format('alter table public.clients add constraint %I check ((%s) or lower(program) in (''free'',''tracker''))',r.conname,expression);
 end loop;
end $$;

create or replace function public.protect_member_entitlements()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare field text;
begin
 if current_user in ('anon','authenticated') then
   if tg_op='INSERT' then raise exception 'Member entitlements must be provisioned by the server'; end if;
   foreach field in array array['client_id','auth_user_id','email','login_email','program','verified_purchase','access','active','subscription_status','subscription_started_at','subscription_ends_at','membership_expires_at'] loop
     if to_jsonb(new)->field is distinct from to_jsonb(old)->field then raise exception 'Member entitlement fields cannot be changed from the browser'; end if;
   end loop;
 end if;
 return new;
end $$;
create or replace trigger protect_member_entitlements before insert or update on public.clients for each row execute function public.protect_member_entitlements();
revoke all on function public.protect_member_entitlements() from public,anon,authenticated;

create or replace function public.enroll_free_community(p_full_name text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid=auth.uid(); owner_email text; c public.clients%rowtype;
begin
 if owner_id is null then raise exception 'Authentication required'; end if;
 if p_full_name is null or length(btrim(p_full_name)) not between 1 and 120 then raise exception 'A profile name is required'; end if;
 select email into owner_email from auth.users where id=owner_id and email_confirmed_at is not null;
 if owner_email is null then raise exception 'Verified email required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
 select * into c from public.clients where auth_user_id=owner_id for update;
 if found then
  if c.program is null or lower(c.program) not in ('free','tracker','ember','ignite','phoenix') then raise exception 'Existing membership tier requires review'; end if;
  return jsonb_build_object('client_id',c.client_id);
 end if;
 insert into public.clients(client_id,auth_user_id,email,login_email,full_name,program,access,active,verified_purchase)
 values('COMM-'||gen_random_uuid()::text,owner_id,owner_email,owner_email,btrim(p_full_name),'free',true,true,false) returning * into c;
 return jsonb_build_object('client_id',c.client_id);
end $$;
revoke all on function public.enroll_free_community(text) from public,anon,authenticated;
grant execute on function public.enroll_free_community(text) to authenticated;

-- Existing authenticated RPCs use invoker security, so these restrictive write
-- policies apply to direct REST calls and RPC writes alike. Reads retain owner history.
do $$ declare r record; action text; expression text; begin
 for r in select * from (values
  ('program_outputs','generatedCoaching'),('workout_logs','workoutLogging'),
  ('workout_exercise_sessions','workoutLogging'),('workout_exercise_sets','workoutLogging'),
  ('nutrition_logs','nutritionTracking'),('macro_entries','nutritionMacroEntry'),('meal_entries','nutritionMealLogging'),
  ('recovery_activity_logs','recoveryBasic'),('recovery_logs','generatedCoaching'),('cycle_logs','generatedCoaching'),
  ('phoenix_daily_task_completions','phoenixTasks'),
  ('assessments','assessmentsView'),('assessment_photos','assessmentPhotoUpload'),
  ('daily_health_metrics','healthRecords'),('health_samples','healthRecords'),('health_integrations','healthRecords'),
  ('anastasis_schedule_events','calendar'),('client_schedule_blocks','calendar'),('workout_plan_feedback','generatedCoaching')
 ) as x(table_name,capability) loop
   if to_regclass('public.'||r.table_name) is null then continue; end if;
   expression=format('public.member_has_capability(client_id,%L)',r.capability);
   if r.table_name='meal_entries' then expression='exists(select 1 from public.nutrition_logs n where n.id=nutrition_log_id and public.member_has_capability(n.client_id,''nutritionMealLogging''))'; end if;
   if r.table_name='workout_exercise_sets' then expression='exists(select 1 from public.workout_exercise_sessions s where s.id=exercise_session_id and public.member_has_capability(s.client_id,''workoutLogging''))'; end if;
   if r.table_name='workout_logs' then expression=expression||' and (coalesce(workout_source,''recommended'')=''manual'' or public.member_has_capability(client_id,''generatedCoaching''))'; end if;
   execute format('alter table public.%I enable row level security',r.table_name);
   foreach action in array array['insert','update','delete'] loop
     execute format('create policy %I on public.%I as restrictive for %s to authenticated %s',
       'membership capability '||action,r.table_name,action,
       case when action='insert' then 'with check ('||expression||')'
            when action='delete' then 'using ('||expression||')'
            else 'using ('||expression||') with check ('||expression||')' end);
   end loop;
 end loop;
end $$;

-- The original macro INSERT policy was Ember-only. Tracker shares manual totals
-- and remains bound to its owned daily log; no premium recommendation grant.
create policy "tracker own manual macro entries" on public.macro_entries for insert to authenticated
 with check(auth_user_id=auth.uid() and public.member_has_capability(client_id,'nutritionMacroEntry') and
 exists(select 1 from public.clients c where c.client_id=macro_entries.client_id and c.auth_user_id=auth.uid() and lower(c.program)='tracker') and
 exists(select 1 from public.nutrition_logs n where n.id=nutrition_log_id and n.client_id=macro_entries.client_id and n.auth_user_id=auth.uid()));

create or replace function community_private.has_member_access() returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.clients c where c.auth_user_id=auth.uid() and public.member_has_capability(c.client_id,'community'))
$$;

alter table public.nutrition_logs add column if not exists tracking_only boolean not null default false;
create table membership_private.tracker_submission_receipts (
 user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,
 client_id text not null references public.clients(client_id) on delete cascade,
 log_date date not null,
 payload jsonb not null,
 nutrition_log_id uuid not null references public.nutrition_logs(id) on delete cascade,
 primary key(user_id,request_id)
);
alter table membership_private.tracker_submission_receipts enable row level security;
revoke all on membership_private.tracker_submission_receipts from public,anon,authenticated;

create or replace function public.record_tracker_nutrition(p_client_id text,p_request_id uuid,p_log_date date,p_values jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.clients%rowtype; n public.nutrition_logs%rowtype; receipt membership_private.tracker_submission_receipts%rowtype;
 field text; amount numeric; has_positive boolean=false;
begin
 if p_client_id is null or membership_private.has_capability(p_client_id,'nutritionTracking') is distinct from true then raise exception 'Active owned membership required'; end if;
 select * into c from public.clients where client_id=p_client_id and auth_user_id=auth.uid() for update;
 if not found or c.program is null or lower(c.program)<>'tracker' then raise exception 'Tracker logging required'; end if;
 if p_request_id is null or p_log_date is null or p_log_date not between current_date-1 and current_date+1 or jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Invalid tracker entry'; end if;
 for field in select jsonb_object_keys(p_values) loop
  if field not in ('calories','protein','carbs','fats','waterOz') or jsonb_typeof(p_values->field) is distinct from 'number' then raise exception 'Invalid actual value'; end if;
  amount=(p_values->>field)::numeric;
  if amount<0 or amount>1000000 or amount::text in ('NaN','Infinity','-Infinity') or (field='waterOz' and (amount<=0 or amount>10000)) then raise exception 'Invalid actual value'; end if;
  has_positive=has_positive or amount>0;
 end loop;
 if not has_positive then raise exception 'Record a positive actual value'; end if;
 select * into receipt from membership_private.tracker_submission_receipts where user_id=auth.uid() and request_id=p_request_id;
 if found then
  if receipt.client_id<>p_client_id or receipt.log_date<>p_log_date or receipt.payload<>p_values then raise exception 'This request identifier was used for another entry'; end if;
  select * into n from public.nutrition_logs where id=receipt.nutrition_log_id and auth_user_id=auth.uid();
  return to_jsonb(n);
 end if;
 select * into n from public.nutrition_logs where client_id=p_client_id and log_date=p_log_date and auth_user_id=auth.uid() for update;
 if not found then
  insert into public.nutrition_logs(client_id,auth_user_id,log_date,calories,protein,carbs,fats,water_oz,water_consumed_oz,tracking_only)
  values(p_client_id,auth.uid(),p_log_date,0,0,0,0,0,0,true) returning * into n;
 end if;
 if coalesce((p_values->>'calories')::numeric,0)+coalesce((p_values->>'protein')::numeric,0)+coalesce((p_values->>'carbs')::numeric,0)+coalesce((p_values->>'fats')::numeric,0)>0 then
  insert into public.macro_entries(id,nutrition_log_id,client_id,auth_user_id,calories,protein_g,carbs_g,fat_g,day_block,entry_source,verified,estimated)
  values(p_request_id,n.id,p_client_id,auth.uid(),coalesce((p_values->>'calories')::numeric,0),coalesce((p_values->>'protein')::numeric,0),coalesce((p_values->>'carbs')::numeric,0),coalesce((p_values->>'fats')::numeric,0),'other','manual',true,false);
 end if;
 update public.nutrition_logs set water_consumed_oz=coalesce(water_consumed_oz,0)+coalesce((p_values->>'waterOz')::numeric,0),updated_at=now()
 where id=n.id and auth_user_id=auth.uid() returning * into n;
 insert into membership_private.tracker_submission_receipts values(auth.uid(),p_request_id,p_client_id,p_log_date,p_values,n.id);
 return to_jsonb(n);
end $$;
revoke all on function public.record_tracker_nutrition(text,uuid,date,jsonb) from public,anon,authenticated;
grant execute on function public.record_tracker_nutrition(text,uuid,date,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
