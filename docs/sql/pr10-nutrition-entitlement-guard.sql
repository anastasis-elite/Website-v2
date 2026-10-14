-- REVIEW PROPOSAL ONLY. Not a migration-history entry; never applied remotely.
-- Apply only after explicit production schema/policy approval and fresh review.
-- No customer backfills, deletes, entitlement updates or new permissive grants.
begin;

create or replace function public.member_has_nutrition_access(p_client_id text, p_tiers text[])
returns boolean language sql stable security invoker set search_path=public,pg_temp as $$
  select exists (
    select 1 from public.clients c
    where c.client_id=p_client_id and c.auth_user_id=(select auth.uid())
      and lower(c.program)=any(p_tiers) and c.access is true and c.active is distinct from false
      -- The captured clients column is DATE. Match Date.parse(date)'s UTC
      -- boundary explicitly, independently of the database session timezone.
      and (c.subscription_ends_at is null or (c.subscription_ends_at::timestamp at time zone 'UTC')>now())
      and (c.verified_purchase is distinct from true or c.subscription_ends_at is not null)
  )
$$;
revoke all on function public.member_has_nutrition_access(text,text[]) from public,anon,authenticated,service_role;
grant execute on function public.member_has_nutrition_access(text,text[]) to authenticated;

create or replace function public.protect_legacy_nutrition_meals()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if current_user in ('anon','authenticated') then
    -- Preserve existing legacy intake while permitting guidance/water changes.
    if (tg_op='INSERT' and coalesce(new.meals,'[]'::jsonb)<>'[]'::jsonb)
       or (tg_op='UPDATE' and new.meals is distinct from old.meals) then
      if not public.member_has_nutrition_access(new.client_id,array['ignite','phoenix']) then
        raise exception 'Food and meal logging require an active IGNITE or PHOENIX membership' using errcode='42501';
      end if;
    end if;
  end if;
  return new;
end $$;
create or replace trigger protect_legacy_nutrition_meals before insert or update on public.nutrition_logs
  for each row execute function public.protect_legacy_nutrition_meals();
revoke all on function public.protect_legacy_nutrition_meals() from public,anon,authenticated,service_role;

-- Historical broad grants on this legacy table include TRUNCATE, which bypasses
-- RLS. Browser roles need none of these table-administration privileges.
revoke truncate, references, trigger on public.food_log_items from public,anon,authenticated;

-- Restrictive mutation policies intersect every existing permissive policy.
-- Preserve existing SELECT behavior, including existing tier/history limits.
do $$
declare item record; operation text; expression text; policy_name text;
begin
  for item in select * from (values
    ('meal_entries', $guard$exists(select 1 from public.nutrition_logs n where n.id=meal_entries.nutrition_log_id
      and public.member_has_nutrition_access(n.client_id,array['ignite','phoenix'])
      and (meal_entries.entry_source<>'photo_estimate' or public.member_has_nutrition_access(n.client_id,array['phoenix'])))$guard$),
    ('macro_entries', $guard$public.member_has_nutrition_access(macro_entries.client_id,array['ember'])$guard$),
    ('recurring_food_patterns', $guard$auth_user_id=(select auth.uid()) and public.member_has_nutrition_access(client_id,array['ignite','phoenix'])$guard$),
    ('foods', $guard$auth_user_id=(select auth.uid()) and source in ('custom','barcode_custom','photo_estimate')
      and public.member_has_nutrition_access(client_id,array['ignite','phoenix'])
      and (source<>'photo_estimate' or public.member_has_nutrition_access(client_id,array['phoenix']))$guard$),
    ('food_nutrients', $guard$exists(select 1 from public.foods f where f.id=food_nutrients.food_id
      and f.auth_user_id=(select auth.uid()) and public.member_has_nutrition_access(f.client_id,array['ignite','phoenix'])
      and (f.source<>'photo_estimate' or public.member_has_nutrition_access(f.client_id,array['phoenix'])))$guard$),
    ('food_serving_options', $guard$exists(select 1 from public.foods f where f.id=food_serving_options.food_id
      and f.auth_user_id=(select auth.uid()) and public.member_has_nutrition_access(f.client_id,array['ignite','phoenix'])
      and (f.source<>'photo_estimate' or public.member_has_nutrition_access(f.client_id,array['phoenix'])))$guard$),
    ('meal_symptoms', $guard$exists(select 1 from public.meal_entries m join public.nutrition_logs n on n.id=m.nutrition_log_id
      where m.id=meal_symptoms.meal_entry_id and public.member_has_nutrition_access(n.client_id,array['ignite','phoenix']))$guard$),
    ('food_log_items', $guard$exists(select 1 from public.clients c where c.id=food_log_items.client_id
      and public.member_has_nutrition_access(c.client_id,array['ignite','phoenix'])
      and (food_log_items.nutrition_log_id is null or exists(select 1 from public.nutrition_logs n
        where n.id=food_log_items.nutrition_log_id and n.client_id=c.client_id))
      and exists(select 1 from public.foods f where f.id=food_log_items.food_id
        and (f.source<>'photo_estimate' or public.member_has_nutrition_access(c.client_id,array['phoenix']))))$guard$)
  ) as guards(table_name,predicate)
  loop
    execute format('alter table public.%I enable row level security',item.table_name);
    foreach operation in array array['insert','update','delete'] loop
      policy_name:='pr10 nutrition authorization '||operation;
      expression:=case operation
        when 'insert' then ' with check ('||item.predicate||')'
        when 'delete' then ' using ('||item.predicate||')'
        else ' using ('||item.predicate||') with check ('||item.predicate||')' end;
      execute format('drop policy if exists %I on public.%I',policy_name,item.table_name);
      execute format('create policy %I on public.%I as restrictive for %s to authenticated%s',policy_name,item.table_name,operation,expression);
    end loop;
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
