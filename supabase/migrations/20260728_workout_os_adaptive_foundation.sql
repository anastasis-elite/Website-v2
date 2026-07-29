alter table public.recovery_logs
  add column if not exists soreness_regions text[] not null default '{}';

alter table public.exercise_metadata
  add column if not exists muscle_contributions jsonb not null default '{}'::jsonb,
  add column if not exists recovery_profile text not null default 'moderate',
  add column if not exists eccentric_demand integer not null default 1,
  add column if not exists stabilization_demand integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'exercise_metadata_eccentric_demand_check'
      and conrelid = 'public.exercise_metadata'::regclass
  ) then
    alter table public.exercise_metadata
      add constraint exercise_metadata_eccentric_demand_check
      check (eccentric_demand between 1 and 5);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'exercise_metadata_stabilization_demand_check'
      and conrelid = 'public.exercise_metadata'::regclass
  ) then
    alter table public.exercise_metadata
      add constraint exercise_metadata_stabilization_demand_check
      check (stabilization_demand between 1 and 5);
  end if;
end $$;
