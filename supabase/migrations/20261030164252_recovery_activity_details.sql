-- Additive only: existing generic recovery and completed breathing logs keep
-- their original columns and behavior. This migration is not applied here.
alter table public.recovery_activity_logs
  add column if not exists activity_details jsonb,
  add column if not exists request_id uuid;

alter table public.recovery_activity_logs
  add constraint recovery_activity_details_shape check (
    activity_details is null or (
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
      )
    ) is true
  );

-- NULL leaves all historical and generic entries independent. Scoped keys
-- cannot collide with another owner's or another client's activity.
create unique index recovery_activity_request_owner_idx
  on public.recovery_activity_logs (user_id, client_id, request_id)
  where request_id is not null;

-- Retain the existing ownership policies and grants. Require client ownership
-- even on installations that predate the shared daily-save foundation policy.
alter table public.recovery_activity_logs enable row level security;
do $policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recovery_activity_logs'
      and policyname = 'p0 referenced client ownership'
  ) then
    create policy "p0 referenced client ownership"
      on public.recovery_activity_logs as restrictive for all to authenticated
      using (user_id = (select auth.uid()))
      with check (
        user_id = (select auth.uid())
        and exists (
          select 1 from public.clients c
          where c.client_id = recovery_activity_logs.client_id
            and c.auth_user_id = (select auth.uid())
        )
      );
  end if;
end
$policy$;
