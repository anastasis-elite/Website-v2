create table if not exists public.dashboard_daily_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  log_date date not null,
  program text not null check (program in ('ember','ignite','phoenix')),
  engine_version text not null,
  input_snapshot jsonb not null default '{}'::jsonb,
  recommendation_output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dashboard_daily_recommendations_key unique (user_id,client_id,log_date)
);
create index if not exists dashboard_recommendations_client_date_idx on public.dashboard_daily_recommendations(client_id,log_date desc);
alter table public.dashboard_daily_recommendations enable row level security;
create policy "Clients read own dashboard recommendations" on public.dashboard_daily_recommendations for select to authenticated using ((select auth.uid())=user_id);
create policy "Clients insert own dashboard recommendations" on public.dashboard_daily_recommendations for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Clients update own dashboard recommendations" on public.dashboard_daily_recommendations for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert,update on public.dashboard_daily_recommendations to authenticated;
