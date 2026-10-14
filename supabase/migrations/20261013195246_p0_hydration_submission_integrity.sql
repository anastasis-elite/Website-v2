-- P0 hydration repair. REVIEW ONLY until explicit production approval.
-- Adds retry receipts without changing existing hydration totals or ownership.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.nutrition_logs
  add column if not exists water_submission_ids uuid[] not null default '{}';

create or replace function public.add_daily_water(
  p_log_id uuid, p_ounces numeric, p_submission_id uuid
)
returns jsonb language plpgsql security invoker
set search_path = public, pg_temp as $$
declare v_log public.nutrition_logs%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_submission_id is null or p_ounces is null or p_ounces <= 0
     or p_ounces::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Enter a valid water amount';
  end if;
  select n.* into v_log from public.nutrition_logs n
  where n.id = p_log_id and n.auth_user_id = auth.uid()
    and exists (select 1 from public.clients c
      where c.client_id = n.client_id and c.auth_user_id = auth.uid())
  for update;
  if not found then raise exception 'Nutrition log not found'; end if;
  if p_submission_id = any(v_log.water_submission_ids) then
    return to_jsonb(v_log);
  end if;
  update public.nutrition_logs
  set water_consumed_oz = coalesce(water_consumed_oz,0) + p_ounces,
      water_submission_ids = array_append(water_submission_ids,p_submission_id),
      updated_at = now()
  where id = v_log.id and auth_user_id = auth.uid()
  returning * into v_log;
  if not found then raise exception 'Nutrition log could not be updated'; end if;
  return to_jsonb(v_log);
end $$;
revoke all on function public.add_daily_water(uuid,numeric,uuid) from PUBLIC, anon, authenticated;
grant execute on function public.add_daily_water(uuid,numeric,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
