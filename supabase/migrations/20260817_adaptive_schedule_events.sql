create table if not exists public.anastasis_schedule_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text references public.clients(client_id) on delete cascade,
  title text not null,
  description text,
  event_type text not null check (event_type in ('workout','meal','hydration','recovery','check_in','assessment','work','school','appointment','medical','dental','personal','household','sleep','custom')),
  source text not null default 'manual' check (source in ('manual','anastasis','program','external_calendar','mobile','system')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  timezone text not null default 'America/Chicago',
  all_day boolean not null default false,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled','skipped','deferred')),
  completed_at timestamptz,
  flexibility_type text not null default 'flexible' check (flexibility_type in ('fixed','flexible','approval_required')),
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  required boolean not null default false,
  movable boolean not null default true,
  approval_required boolean not null default false,
  earliest_start_at timestamptz,
  latest_end_at timestamptz,
  preferred_time time,
  estimated_duration_minutes integer check (estimated_duration_minutes is null or estimated_duration_minutes between 1 and 1440),
  external_provider_name text,
  external_contact_type text check (external_contact_type is null or external_contact_type in ('email','phone','sms','portal','other')),
  external_contact_value text,
  external_event_id text,
  external_calendar_source text,
  reschedule_allowed boolean not null default false,
  reschedule_requires_approval boolean not null default true,
  last_reschedule_requested_at timestamptz,
  delegation_status text check (delegation_status is null or delegation_status in ('not_requested','approval_needed','requested','waiting_for_response','confirmed','declined','cancelled')),
  delegation_notes text,
  adaptive_reason text,
  adjusted_start_at timestamptz,
  adjusted_end_at timestamptz,
  adjusted_duration_minutes integer check (adjusted_duration_minutes is null or adjusted_duration_minutes between 1 and 1440),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint anastasis_schedule_events_end_after_start check (end_at > start_at),
  constraint anastasis_schedule_events_window_order check (
    earliest_start_at is null or latest_end_at is null or latest_end_at > earliest_start_at
  ),
  constraint anastasis_schedule_events_fixed_control check (
    flexibility_type <> 'fixed' or (movable = false and approval_required = true)
  ),
  constraint anastasis_schedule_events_external_control check (
    external_event_id is null or reschedule_requires_approval = true
  )
);

create index if not exists anastasis_schedule_events_user_start_idx
  on public.anastasis_schedule_events(user_id, start_at);
create index if not exists anastasis_schedule_events_client_start_idx
  on public.anastasis_schedule_events(client_id, start_at);
create index if not exists anastasis_schedule_events_user_status_idx
  on public.anastasis_schedule_events(user_id, status, start_at);
create index if not exists anastasis_schedule_events_external_idx
  on public.anastasis_schedule_events(user_id, external_calendar_source, external_event_id)
  where external_event_id is not null;

alter table public.anastasis_schedule_events enable row level security;

create policy "Clients read own schedule events"
  on public.anastasis_schedule_events for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Clients insert own schedule events"
  on public.anastasis_schedule_events for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      client_id is null
      or exists (
        select 1 from public.clients c
        where c.client_id = anastasis_schedule_events.client_id
          and c.auth_user_id = (select auth.uid())
      )
    )
  );

create policy "Clients update own schedule events"
  on public.anastasis_schedule_events for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      client_id is null
      or exists (
        select 1 from public.clients c
        where c.client_id = anastasis_schedule_events.client_id
          and c.auth_user_id = (select auth.uid())
      )
    )
  );

create policy "Clients delete own schedule events"
  on public.anastasis_schedule_events for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.anastasis_schedule_events to authenticated;
