-- Restrictive policies compose with existing owner policies without widening RLS.
create policy "meal logging tier boundary" on public.meal_entries
  as restrictive for all to authenticated
  using (
    exists (
      select 1 from public.nutrition_logs nl
      join public.clients c on c.client_id = nl.client_id
      where nl.id = meal_entries.nutrition_log_id
        and nl.auth_user_id = (select auth.uid())
        and c.auth_user_id = (select auth.uid())
        and lower(c.program) in ('ignite', 'phoenix')
    )
  )
  with check (
    exists (
      select 1 from public.nutrition_logs nl
      join public.clients c on c.client_id = nl.client_id
      where nl.id = meal_entries.nutrition_log_id
        and nl.auth_user_id = (select auth.uid())
        and c.auth_user_id = (select auth.uid())
        and lower(c.program) in ('ignite', 'phoenix')
        and (meal_entries.entry_source <> 'photo_estimate' or lower(c.program) = 'phoenix')
    )
    and exists (select 1 from public.foods f where f.id = meal_entries.food_id)
    and (serving_option_id is null or exists (
      select 1 from public.food_serving_options s
      where s.id = meal_entries.serving_option_id and s.food_id = meal_entries.food_id
    ))
    and (recurring_food_id is null or exists (
      select 1 from public.recurring_food_patterns r
      where r.id = meal_entries.recurring_food_id
        and r.auth_user_id = (select auth.uid())
        and r.food_id = meal_entries.food_id
    ))
    and serving_amount > 0 and grams > 0
  );

-- Older permissive catalog policies remain in some installations. Add a
-- restrictive boundary so they cannot expose another user's private foods.
create policy "food catalog privacy boundary" on public.foods
  as restrictive for select to public
  using (source = 'catalog' or auth_user_id = (select auth.uid()));

create policy "food nutrient privacy boundary" on public.food_nutrients
  as restrictive for select to public
  using (exists (select 1 from public.foods f where f.id = food_nutrients.food_id));

create policy "food serving privacy boundary" on public.food_serving_options
  as restrictive for select to public
  using (exists (select 1 from public.foods f where f.id = food_serving_options.food_id));

create policy "custom food tier boundary" on public.foods
  as restrictive for insert to authenticated
  with check (exists (
    select 1 from public.clients c
    where c.client_id = foods.client_id
      and c.auth_user_id = (select auth.uid())
      and lower(c.program) in ('ignite', 'phoenix')
      and (foods.source <> 'photo_estimate' or lower(c.program) = 'phoenix')
  ));

-- Preserve the deployed view columns and calculations, only exclude unconfirmed
-- candidates. Views continue using the caller's RLS permissions.
do $$
declare
  v_name text;
  v_definition text;
begin
  foreach v_name in array array['nutrition_log_totals', 'nutrition_log_totals_by_block'] loop
    v_definition := pg_get_viewdef(('public.' || v_name)::regclass, true);
    if position('entry_state' in v_definition) = 0 then
      if position('GROUP BY' in v_definition) = 0 or position('WHERE' in v_definition) > 0 then
        raise exception 'Review nutrition view % before changing its confirmed filter', v_name;
      end if;
      v_definition := replace(v_definition, 'GROUP BY', 'WHERE me.entry_state = ''confirmed'' GROUP BY');
      execute format('create or replace view public.%I with (security_invoker=true) as %s', v_name, v_definition);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
