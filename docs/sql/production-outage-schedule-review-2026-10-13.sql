-- REVIEW ONLY. NOT EXECUTED. Requires explicit approval for production execution.
-- Target: Supabase lcccpqgnpznhbtmkmytp, verified 2026-10-13.
-- Narrow repair for recurring commitments; no launch backfill or existing-row changes.
-- Stop if metadata changed since review; do not run a blind supabase db push.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $preflight$
begin
  if to_regclass('public.clients') is null then
    raise exception 'Expected clients base table is absent';
  end if;
  if to_regclass('public.client_schedule_blocks') is not null then
    raise exception 'Schedule table now exists: review current definitions before repair';
  end if;
  if to_regprocedure('public.replace_daily_commitments(text,jsonb)') is not null then
    raise exception 'Commitments RPC now exists: review current definition before repair';
  end if;
end
$preflight$;

create table public.client_schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references public.clients(client_id) on delete cascade,
  block_type text not null check (block_type in
    ('sleep','work','school_dropoff','school_pickup','commute','appointment','other')),
  label text,
  days_of_week smallint[] not null default '{}',
  start_time time not null,
  end_time time not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_schedule_blocks_client_idx
  on public.client_schedule_blocks(client_id,active);
create index client_schedule_blocks_user_idx
  on public.client_schedule_blocks(user_id);
alter table public.client_schedule_blocks enable row level security;
revoke all on table public.client_schedule_blocks from public,anon,authenticated;
create policy "members manage owned client commitments"
  on public.client_schedule_blocks for all to authenticated
  using (
    user_id=(select auth.uid()) and exists (
      select 1 from public.clients c
      where c.client_id=client_schedule_blocks.client_id
        and c.auth_user_id=(select auth.uid())
    )
  )
  with check (
    user_id=(select auth.uid()) and exists (
      select 1 from public.clients c
      where c.client_id=client_schedule_blocks.client_id
        and c.auth_user_id=(select auth.uid())
    )
  );
grant select,insert,update,delete on public.client_schedule_blocks to authenticated;

-- SECURITY INVOKER preserves table RLS. The client row serializes replacements.
-- DELETE and INSERT are one function transaction; invalid inserts restore old blocks.
create function public.replace_daily_commitments(p_client_id text,p_blocks jsonb)
returns void language plpgsql security invoker
set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform 1 from public.clients
    where client_id=p_client_id and auth_user_id=auth.uid() for update;
  if not found then raise exception 'Client not found'; end if;
  if jsonb_typeof(p_blocks) is distinct from 'array' then
    raise exception 'Invalid commitments';
  end if;
  if jsonb_array_length(p_blocks)>100 then raise exception 'Invalid commitments'; end if;
  delete from public.client_schedule_blocks
    where client_id=p_client_id and user_id=auth.uid();
  insert into public.client_schedule_blocks
    (user_id,client_id,block_type,label,days_of_week,start_time,end_time,active)
  select auth.uid(),p_client_id,block_type,label,days_of_week,
         start_time::time,end_time::time,true
  from jsonb_to_recordset(p_blocks) as x
    (block_type text,label text,days_of_week smallint[],start_time text,end_time text);
end
$$;
revoke all on function public.replace_daily_commitments(text,jsonb) from public,anon;
grant execute on function public.replace_daily_commitments(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
