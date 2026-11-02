-- PREPARED REVIEW INPUT ONLY: not applied or registered as a hosted migration.
-- Prerequisite: 20261030164252_recovery_activity_details.sql (columns, shape
-- constraint and owner-scoped request index). Register this as a NEW migration;
-- leave that historical migration unchanged. Supabase CLI is unavailable here.
-- Release order: owner review/approval -> apply this compatibility SQL -> release
-- the Sauna writer. Old walk, soak and generic writers remain compatible.
-- No grants, RLS policies, request uniqueness or existing rows are changed.
-- Rollback: disable the Sauna writer first. Restore the old constraint ONLY if
-- no Sauna detail rows exist. If any exist, retain this compatible constraint
-- pending operator review; do not erase or disguise recorded sessions.

begin;

do $prerequisite$
begin
  if to_regclass('public.recovery_activity_logs') is null or not exists (
    select 1 from pg_constraint
    where conrelid = to_regclass('public.recovery_activity_logs')
      and conname = 'recovery_activity_details_shape' and contype = 'c'
  ) or to_regclass('public.recovery_activity_request_owner_idx') is null then
    raise exception 'Apply the existing recovery details foundation before Sauna compatibility';
  end if;
  -- Historical generic Sauna rows cannot be silently assigned a duration/source
  -- or context. Abort without changing them if operator reconciliation is needed.
  if exists (select 1 from public.recovery_activity_logs where activity_type = 'Sauna' and activity_details is null) then
    raise exception 'Existing generic Sauna rows require operator review before detailed Sauna logging';
  end if;
end
$prerequisite$;

alter table public.recovery_activity_logs
  drop constraint recovery_activity_details_shape;

alter table public.recovery_activity_logs
  add constraint recovery_activity_details_shape check (
    (activity_details is null and activity_type is distinct from 'Sauna') or (
      request_id is not null
      and jsonb_typeof(activity_details) = 'object'
      and activity_details->>'source' = 'manual'
      and jsonb_typeof(activity_details->'durationMinutes') = 'number'
      and (activity_details->>'durationMinutes')::numeric > 0
      and (activity_details->>'durationMinutes')::numeric <= 1440
      and duration_minutes = floor((activity_details->>'durationMinutes')::numeric)
      and (
        (activity_details->>'kind' = 'slow_walk' and activity_type = 'Gentle walk')
        or (activity_details->>'kind' = 'warm_soak' and activity_type = 'Warm soak')
        or (
          activity_details->>'kind' = 'sauna' and activity_type = 'Sauna'
          and jsonb_typeof(activity_details->'context') = 'string'
          and activity_details->>'context' in ('before_workout','after_workout','standalone')
          and activity_details - array['kind','source','durationMinutes','context','heartRateBpm']::text[] = '{}'::jsonb
          and (
            not (activity_details ? 'heartRateBpm') or case
              when jsonb_typeof(activity_details->'heartRateBpm') = 'number' then
                (activity_details->>'heartRateBpm')::numeric between 1 and 300
                and trunc((activity_details->>'heartRateBpm')::numeric) = (activity_details->>'heartRateBpm')::numeric
              else false
            end
          )
        )
      )
    ) is true
  );

commit;
