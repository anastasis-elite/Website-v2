create table if not exists public.macro_entries (
  id uuid primary key default gen_random_uuid(),
  nutrition_log_id uuid not null references public.nutrition_logs(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  calories numeric not null default 0 check (calories >= 0),
  protein_g numeric not null default 0 check (protein_g >= 0),
  carbs_g numeric not null default 0 check (carbs_g >= 0),
  fat_g numeric not null default 0 check (fat_g >= 0),
  day_block text not null default 'other' check (day_block in ('morning','midday','evening','other')),
  created_at timestamptz not null default now()
);

create index if not exists macro_entries_log_created_idx
  on public.macro_entries(nutrition_log_id, created_at desc);

create index if not exists macro_entries_client_created_idx
  on public.macro_entries(client_id, created_at desc);

alter table public.macro_entries enable row level security;

create policy "clients read own macro entries" on public.macro_entries
  for select to authenticated
  using ((select auth.uid()) = auth_user_id);

create policy "clients insert own macro entries" on public.macro_entries
  for insert to authenticated
  with check (
    (select auth.uid()) = auth_user_id
    and exists (
      select 1
      from public.clients c
      where c.client_id = macro_entries.client_id
        and c.auth_user_id = (select auth.uid())
        and lower(coalesce(c.program, 'ignite')) = 'ember'
    )
    and exists (
      select 1
      from public.nutrition_logs nl
      where nl.id = macro_entries.nutrition_log_id
        and nl.client_id = macro_entries.client_id
        and nl.auth_user_id = (select auth.uid())
    )
  );

grant select, insert on public.macro_entries to authenticated;
