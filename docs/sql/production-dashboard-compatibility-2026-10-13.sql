-- Read-only catalog checks for the ANASTASIS dashboard outage.
-- Target must be confirmed separately: lcccpqgnpznhbtmkmytp.
-- This file never reads customer records or changes database/schema state.

with required(name, feature) as (values
  ('clients','authenticated member identity and saved preferences'),
  ('client_current_profiles','optional effective profile'),
  ('program_outputs','saved program'),
  ('assessments','daily and monthly assessments'),
  ('recovery_logs','daily check-in, workout readiness and recovery'),
  ('cycle_logs','daily check-in cycle answers'),
  ('client_symptom_logs','safety and daily signals'),
  ('symptom_types','symptom join'),
  ('nutrition_logs','hydration and nutrition state'),
  ('nutrition_log_totals_by_block','confirmed meal totals'),
  ('nutrition_log_remaining','nutrition remaining totals'),
  ('meal_entries','saved meals'),
  ('macro_entries','EMBER nutrition'),
  ('workout_logs','saved workout history'),
  ('workout_exercise_sessions','manual workout set logging'),
  ('workout_exercise_sets','manual workout set logging'),
  ('workout_plan_feedback','workout feedback'),
  ('exercise_metadata','adaptive workout reference'),
  ('measurement_logs','progress'),
  ('assessment_photos','progress photos'),
  ('phoenix_daily_task_completions','PHOENIX completion state'),
  ('recovery_activity_logs','saved recovery activities'),
  ('daily_execution_status','streak history and derived state'),
  ('dashboard_daily_recommendations','derived dashboard recommendations'),
  ('daily_health_metrics','optional wearable signals'),
  ('sleep_logs','sleep state'),
  ('body_assessment_sessions','optional body assessment status'),
  ('anastasis_schedule_events','saved internal schedule events'),
  ('client_schedule_blocks','optional recurring commitments'),
  ('calendar_events','optional connected calendar imports'),
  ('connected_calendars','optional selected external calendars'),
  ('calendar_connections','optional connected calendar labels'),
  ('recommendation_audit_logs','optional recommendation audit append')
), relations as (
  select r.*, c.oid, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
         c.reloptions
  from required r
  left join pg_namespace n on n.nspname='public'
  left join pg_class c on c.relnamespace=n.oid and c.relname=r.name
)
select name, feature, oid is not null as present, relkind,
       relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced,
       reloptions as view_options,
       case when oid is not null then has_table_privilege('authenticated',oid,'SELECT') end as authenticated_select,
       case when oid is not null then has_table_privilege('authenticated',oid,'INSERT') end as authenticated_insert,
       case when oid is not null then has_table_privilege('authenticated',oid,'UPDATE') end as authenticated_update,
       case when oid is not null then has_table_privilege('authenticated',oid,'DELETE') end as authenticated_delete,
       case when oid is not null then has_table_privilege('anon',oid,'SELECT,INSERT,UPDATE,DELETE') end as anon_any_access,
       case when oid is not null then has_table_privilege('service_role',oid,'INSERT') end as service_insert
from relations order by name;

with required(table_name,column_name,feature) as (values
  ('cycle_logs','answered_fields','partial check-in answer preservation'),
  ('nutrition_logs','water_submission_ids','water retry deduplication'),
  ('workout_logs','workout_source','workout source attribution'),
  ('workout_logs','planned_exercises','planned workout resume'),
  ('recovery_logs','check_in_completed_at','confirmed daily check-in'),
  ('recovery_logs','soreness_regions','workout readiness'),
  ('meal_entries','entry_state','confirmed nutrition only'),
  ('client_schedule_blocks','user_id','schedule ownership'),
  ('client_schedule_blocks','client_id','schedule ownership'),
  ('client_schedule_blocks','block_type','recurring schedule adapter'),
  ('client_schedule_blocks','days_of_week','recurring schedule adapter'),
  ('client_schedule_blocks','start_time','recurring schedule adapter'),
  ('client_schedule_blocks','end_time','recurring schedule adapter')
)
select r.*, c.column_name is not null as present, c.data_type, c.udt_name,
       c.is_nullable, c.column_default
from required r left join information_schema.columns c
  on c.table_schema='public' and c.table_name=r.table_name and c.column_name=r.column_name
order by r.table_name,r.column_name;

with required(signature,feature) as (values
  ('public.add_daily_water(uuid,numeric,uuid)','atomic water add and retry deduplication'),
  ('public.replace_daily_commitments(text,jsonb)','atomic recurring schedule replacement'),
  ('public.save_daily_workout(text,timestamptz,timestamptz,jsonb)','owned daily workout save/resume'),
  ('public.replace_workout_sets(uuid,jsonb)','atomic recorded set replacement')
), functions as (
  select r.*, to_regprocedure(signature) as oid from required r
)
select f.signature,f.feature,f.oid is not null as present,
       p.prosecdef as security_definer,p.proconfig as configuration,
       case when f.oid is not null then has_function_privilege('authenticated',f.oid,'EXECUTE') end as authenticated_execute,
       case when f.oid is not null then has_function_privilege('anon',f.oid,'EXECUTE') end as anon_execute
from functions f left join pg_proc p on p.oid=f.oid order by f.signature;

select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname='public' and tablename in
  ('clients','client_schedule_blocks','recommendation_audit_logs',
   'nutrition_logs','recovery_logs','cycle_logs','workout_logs',
   'workout_exercise_sessions','workout_exercise_sets','program_outputs')
order by tablename,policyname;

select n.nspname as schema_name,c.relname as table_name,t.tgname as trigger_name,
       pg_get_triggerdef(t.oid) as definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal and n.nspname='public'
  and c.relname in ('recommendation_audit_logs','clients')
order by c.relname,t.tgname;

select version,name from supabase_migrations.schema_migrations order by version;
