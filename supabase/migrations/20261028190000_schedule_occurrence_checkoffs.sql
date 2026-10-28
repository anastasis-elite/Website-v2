-- REVIEW ONLY: apply through the normal migration process before releasing
-- Schedule check-offs. No provider calendar rows or health logs are changed.
create table public.schedule_occurrence_checkoffs (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  occurrence_date date not null,
  event_id text not null check (length(event_id) between 1 and 1024),
  completed boolean not null,
  completed_at timestamptz,
  revision integer not null check (revision > 0),
  operation_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, client_id, occurrence_date, event_id),
  check (completed = (completed_at is not null))
);

alter table public.schedule_occurrence_checkoffs enable row level security;

create policy "Members read their occurrence checkoffs"
  on public.schedule_occurrence_checkoffs for select to authenticated
  using ((select auth.uid()) = user_id and exists (
    select 1 from public.clients c where c.client_id = schedule_occurrence_checkoffs.client_id
      and c.auth_user_id = (select auth.uid())
  ));

create policy "Members insert their occurrence checkoffs"
  on public.schedule_occurrence_checkoffs for insert to authenticated
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.clients c where c.client_id = schedule_occurrence_checkoffs.client_id
      and c.auth_user_id = (select auth.uid())
  ));

create policy "Members update their occurrence checkoffs"
  on public.schedule_occurrence_checkoffs for update to authenticated
  using ((select auth.uid()) = user_id and exists (
    select 1 from public.clients c where c.client_id = schedule_occurrence_checkoffs.client_id
      and c.auth_user_id = (select auth.uid())
  ))
  with check ((select auth.uid()) = user_id and exists (
    select 1 from public.clients c where c.client_id = schedule_occurrence_checkoffs.client_id
      and c.auth_user_id = (select auth.uid())
  ));

-- Explicit Data API privileges are part of this reviewable migration only.
-- Deletion follows account/client cascades; member requests need no delete grant.
revoke all on public.schedule_occurrence_checkoffs from anon, authenticated;
grant select, insert, update on public.schedule_occurrence_checkoffs to authenticated;
