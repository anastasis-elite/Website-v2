-- P0 calendar dependencies. REVIEW ONLY until explicit production approval.
-- No provider connections or external events are changed by this migration.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- SOURCE: 20261011210620_connected_calendars.sql
-- SHA256: 03e2b5cb5c746226661c8afa0bca7d225a76cf9003706541ff93896acd856dd8
-- Additive calendar integration. No changes to subscription, nutrition, login or existing events.
create table if not exists public.calendar_connections (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null check(provider in ('google','icloud')), provider_account_id text not null, account_label text not null,
 status text not null default 'connected' check(status in ('connected','reconnect_required','error')),
 last_synced_at timestamptz, error_code text, error_message text, next_sync_at timestamptz not null default now(),
 failure_count integer not null default 0, lease_id uuid, lease_until timestamptz,
 created_at timestamptz not null default now(), unique(user_id,provider,provider_account_id), unique(id,user_id)
);
revoke all on table public.calendar_connections from public, anon, authenticated;
grant all on table public.calendar_connections to service_role;


create table if not exists public.calendar_credentials (
 connection_id uuid primary key references public.calendar_connections(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, encrypted_value text not null,
 foreign key(connection_id,user_id) references public.calendar_connections(id,user_id) on delete cascade
);
revoke all on table public.calendar_credentials from public, anon, authenticated;
grant all on table public.calendar_credentials to service_role;


create table if not exists public.connected_calendars (
 id uuid primary key default gen_random_uuid(), connection_id uuid not null, user_id uuid not null,
 provider_calendar_id text not null, name text not null, timezone text not null default 'UTC',
 writable boolean not null default false, selected boolean not null default false,
 sync_token text, metadata jsonb not null default '{}', last_synced_at timestamptz,
 foreign key(connection_id,user_id) references public.calendar_connections(id,user_id) on delete cascade,
 unique(connection_id,provider_calendar_id), unique(id,user_id)
);
revoke all on table public.connected_calendars from public, anon, authenticated;
grant all on table public.connected_calendars to service_role;


create table if not exists public.calendar_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 default_calendar_id uuid references public.connected_calendars(id) on delete set null,
 timezone text not null default 'America/Chicago', preferred_start time not null default '07:00', preferred_end time not null default '21:00',
 buffer_minutes integer not null default 10 check(buffer_minutes between 0 and 120),
 check(preferred_end > preferred_start)
);
revoke all on table public.calendar_preferences from public, anon, authenticated;
grant all on table public.calendar_preferences to service_role;


create table if not exists public.calendar_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 calendar_id uuid, provider_event_id text not null, provider_payload jsonb not null,
 event_type text not null default 'personal', etag text not null, synced_at timestamptz not null default now(),
 foreign key(calendar_id,user_id) references public.connected_calendars(id,user_id) on delete cascade,
 unique(calendar_id,provider_event_id), unique(id,user_id)
);
revoke all on table public.calendar_events from public, anon, authenticated;
grant all on table public.calendar_events to service_role;


create table if not exists public.calendar_oauth_states (
 state_hash text primary key, user_id uuid not null references auth.users(id) on delete cascade,
 encrypted_verifier text not null, expires_at timestamptz not null, created_at timestamptz not null default now()
);
revoke all on table public.calendar_oauth_states from public, anon, authenticated;
grant all on table public.calendar_oauth_states to service_role;


create table if not exists public.calendar_write_operations (
 user_id uuid not null references auth.users(id) on delete cascade, idempotency_key uuid not null,
 request_hash text not null, response jsonb,
 connection_id uuid references public.calendar_connections(id) on delete cascade,
 target_event_id uuid, target_external boolean, target_calendar_id uuid,
 target_provider_event_id text, target_provider_etag text,
 deletion_confirmed boolean not null default false, created_at timestamptz not null default now(),
 primary key(user_id,idempotency_key),
 foreign key(connection_id,user_id) references public.calendar_connections(id,user_id) on delete cascade,
 foreign key(target_calendar_id,user_id) references public.connected_calendars(id,user_id) on delete cascade
);
revoke all on table public.calendar_write_operations from public, anon, authenticated;
grant all on table public.calendar_write_operations to service_role;


create index if not exists calendar_connections_due_idx on public.calendar_connections(next_sync_at) where status <> 'reconnect_required';

create index if not exists calendar_events_user_idx on public.calendar_events(user_id);

create index if not exists connected_calendars_user_idx on public.connected_calendars(user_id);

-- All exposed tables are user-specific read-only via Data API. Writes go through ownership-checked server routes.
alter table public.calendar_connections enable row level security;

alter table public.connected_calendars enable row level security;

alter table public.calendar_preferences enable row level security;

alter table public.calendar_events enable row level security;

alter table public.calendar_credentials enable row level security;

alter table public.calendar_oauth_states enable row level security;

alter table public.calendar_write_operations enable row level security;

revoke all on public.calendar_connections, public.connected_calendars, public.calendar_preferences, public.calendar_events,
 public.calendar_credentials, public.calendar_oauth_states, public.calendar_write_operations from anon, authenticated;

grant select on public.calendar_connections, public.connected_calendars, public.calendar_preferences, public.calendar_events to authenticated;

grant all on public.calendar_connections, public.connected_calendars, public.calendar_preferences, public.calendar_events,
 public.calendar_credentials, public.calendar_oauth_states, public.calendar_write_operations to service_role;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='calendar_connections' and policyname='calendar_connections_owner') then
    create policy calendar_connections_owner on public.calendar_connections for select to authenticated using((select auth.uid())=user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='connected_calendars' and policyname='connected_calendars_owner') then
    create policy connected_calendars_owner on public.connected_calendars for select to authenticated using((select auth.uid())=user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='calendar_preferences' and policyname='calendar_preferences_owner') then
    create policy calendar_preferences_owner on public.calendar_preferences for select to authenticated using((select auth.uid())=user_id);
  end if;
end
$source_policy$;
do $source_policy$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='calendar_events' and policyname='calendar_events_owner') then
    create policy calendar_events_owner on public.calendar_events for select to authenticated using((select auth.uid())=user_id);
  end if;
end
$source_policy$;

-- Service-only atomic lease; invoker rights, no bypass of RLS for browser users.
create or replace function public.claim_calendar_sync(p_id uuid, p_user uuid, p_lease uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
 update public.calendar_connections set lease_id=p_lease, lease_until=now()+interval '4 minutes'
 where id=p_id and user_id=p_user and (lease_until is null or lease_until < now());
 return found;
end; $$;

revoke all on function public.claim_calendar_sync(uuid,uuid,uuid) from public,anon,authenticated;

grant execute on function public.claim_calendar_sync(uuid,uuid,uuid) to service_role;

-- Atomic account disconnect cascades imported data/credentials. Never deletes provider events.
create or replace function public.disconnect_calendar(p_id uuid,p_user uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
 delete from public.calendar_connections where id=p_id and user_id=p_user;
 return found;
end; $$;

revoke all on function public.disconnect_calendar(uuid,uuid) from public,anon,authenticated;

grant execute on function public.disconnect_calendar(uuid,uuid) to service_role;


notify pgrst,'reload schema';
commit;
