create table if not exists public.exercise_metadata (
  id uuid primary key default gen_random_uuid(),
  exercise_key text not null unique,
  display_name text not null,
  movement_pattern text not null,
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  equipment text[] not null default '{}',
  skill_level text not null default 'beginner',
  mobility_requirement integer not null default 1 check (mobility_requirement between 1 and 5),
  balance_requirement integer not null default 1 check (balance_requirement between 1 and 5),
  structural_contraindications text[] not null default '{}',
  capacity_cost integer not null default 1 check (capacity_cost between 1 and 5),
  regression_options text[] not null default '{}',
  progression_options text[] not null default '{}',
  movement_tags text[] not null default '{}',
  universal_cues text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.exercise_metadata enable row level security;
create policy "Staff manage exercise metadata" on public.exercise_metadata for all to authenticated using ((select auth.jwt()->'app_metadata'->>'role') in ('admin','coach')) with check ((select auth.jwt()->'app_metadata'->>'role') in ('admin','coach'));
grant select,insert,update,delete on public.exercise_metadata to authenticated;
