create table if not exists public.health_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text references public.clients(client_id) on delete cascade,
  provider text not null check (provider in ('apple_health','health_connect')),
  platform text not null check (platform in ('ios','android')),
  connection_status text not null default 'disconnected' check (connection_status in ('disconnected','connected','unavailable','error')),
  permission_status text not null default 'unknown' check (permission_status in ('unknown','not_requested','granted','partial','denied','unavailable')),
  sync_status text not null default 'idle' check (sync_status in ('idle','syncing','success','partial_success','error')),
  last_sync_started_at timestamptz,
  last_sync_completed_at timestamptz,
  last_successful_sync_at timestamptz,
  last_error text,
  provider_sync_state jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists public.health_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  provider text not null check (provider in ('apple_health','health_connect')),
  metric_type text not null check (metric_type in (
    'sleep_duration',
    'sleep_stage',
    'resting_heart_rate',
    'heart_rate_variability',
    'respiratory_rate',
    'body_temperature',
    'steps',
    'active_energy',
    'workout',
    'walking_running_distance',
    'body_weight',
    'body_fat_percentage'
  )),
  value numeric not null,
  unit text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  source_name text,
  source_device text,
  source_record_id text,
  dedupe_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint health_samples_end_after_start check (end_at >= start_at),
  unique (user_id, provider, dedupe_key)
);

create table if not exists public.daily_health_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  metric_date date not null,
  timezone text not null default 'America/Chicago',
  metric_type text not null check (metric_type in (
    'sleep_duration',
    'sleep_stage',
    'resting_heart_rate',
    'heart_rate_variability',
    'respiratory_rate',
    'body_temperature',
    'steps',
    'active_energy',
    'workout',
    'walking_running_distance',
    'body_weight',
    'body_fat_percentage'
  )),
  value numeric,
  unit text not null,
  status text not null default 'unavailable' check (status in ('measured','aggregated','unavailable')),
  sample_count integer not null default 0 check (sample_count >= 0),
  provider_count integer not null default 0 check (provider_count >= 0),
  source_providers text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id, metric_date, metric_type)
);

create index if not exists health_integrations_user_status_idx
  on public.health_integrations(user_id, provider, connection_status);

create index if not exists health_samples_user_metric_start_idx
  on public.health_samples(user_id, client_id, metric_type, start_at desc);

create index if not exists health_samples_source_record_idx
  on public.health_samples(provider, source_record_id)
  where source_record_id is not null;

create index if not exists daily_health_metrics_client_date_idx
  on public.daily_health_metrics(client_id, metric_date desc);

alter table public.health_integrations enable row level security;
alter table public.health_samples enable row level security;
alter table public.daily_health_metrics enable row level security;

create policy "Clients read own health integrations"
  on public.health_integrations for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Clients insert own health integrations"
  on public.health_integrations for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      client_id is null
      or exists (
        select 1 from public.clients c
        where c.client_id = health_integrations.client_id
          and c.auth_user_id = (select auth.uid())
      )
    )
  );

create policy "Clients update own health integrations"
  on public.health_integrations for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      client_id is null
      or exists (
        select 1 from public.clients c
        where c.client_id = health_integrations.client_id
          and c.auth_user_id = (select auth.uid())
      )
    )
  );

create policy "Clients read own health samples"
  on public.health_samples for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Clients insert own health samples"
  on public.health_samples for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.clients c
      where c.client_id = health_samples.client_id
        and c.auth_user_id = (select auth.uid())
    )
  );

create policy "Clients update own health samples"
  on public.health_samples for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.clients c
      where c.client_id = health_samples.client_id
        and c.auth_user_id = (select auth.uid())
    )
  );

create policy "Clients read own daily health metrics"
  on public.daily_health_metrics for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Clients insert own daily health metrics"
  on public.daily_health_metrics for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.clients c
      where c.client_id = daily_health_metrics.client_id
        and c.auth_user_id = (select auth.uid())
    )
  );

create policy "Clients update own daily health metrics"
  on public.daily_health_metrics for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.clients c
      where c.client_id = daily_health_metrics.client_id
        and c.auth_user_id = (select auth.uid())
    )
  );

revoke all on public.health_integrations from anon, authenticated;
revoke all on public.health_samples from anon, authenticated;
revoke all on public.daily_health_metrics from anon, authenticated;

grant select, insert, update on public.health_integrations to authenticated;
grant select, insert, update on public.health_samples to authenticated;
grant select, insert, update on public.daily_health_metrics to authenticated;
