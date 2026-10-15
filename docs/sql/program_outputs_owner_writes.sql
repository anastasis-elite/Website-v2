-- Reviewable additive migration. Not applied to production.
-- Create a timestamped Supabase migration from this source once CLI setup is available.
-- Existing programs and legacy output JSON remain intact.
begin;

create table if not exists public.program_outputs (
  id uuid primary key default gen_random_uuid(),
  client_id text not null references public.clients(client_id),
  auth_user_id uuid references auth.users(id),
  program text not null,
  status text,
  program_json jsonb,
  generated_at timestamptz not null default now()
);
alter table public.program_outputs
  add column if not exists auth_user_id uuid references auth.users(id),
  add column if not exists program_json jsonb,
  add column if not exists status text;
alter table public.program_outputs enable row level security;
grant select, insert, update on public.program_outputs to authenticated;

-- Restrictive ownership applies even when a previous deployment has broader policies.
create policy "member program ownership boundary" on public.program_outputs
  as restrictive for all to authenticated
  using (exists (
    select 1 from public.clients c
    where c.client_id = program_outputs.client_id
      and c.auth_user_id = (select auth.uid())
      and (program_outputs.auth_user_id is null or program_outputs.auth_user_id = (select auth.uid()))
  ))
  with check (program_outputs.auth_user_id = (select auth.uid()) and exists (
    select 1 from public.clients c
    where c.client_id = program_outputs.client_id
      and c.auth_user_id = (select auth.uid())
      and c.program = program_outputs.program
      and c.access is true and c.active is true
  ));
create policy "members read saved programs" on public.program_outputs
  for select to authenticated using (true);
create policy "members save own programs" on public.program_outputs
  for insert to authenticated with check (true);
create policy "members update own programs" on public.program_outputs
  for update to authenticated using (true) with check (true);

commit;
