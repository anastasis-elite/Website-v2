-- Nutrition logging integrity hardening.
-- Additive-only: restores authenticated catalog reads, preserves private food
-- boundaries, and adds an atomic custom-food creation RPC.

alter table if exists public.foods enable row level security;
alter table if exists public.food_nutrients enable row level security;
alter table if exists public.food_serving_options enable row level security;
alter table if exists public.nutrition_logs enable row level security;
alter table if exists public.meal_entries enable row level security;
alter table if exists public.macro_entries enable row level security;
alter table if exists public.meal_symptoms enable row level security;

grant select, insert on public.foods to authenticated;
grant select, insert on public.food_nutrients to authenticated;
grant select, insert on public.food_serving_options to authenticated;
grant select, insert, update on public.nutrition_logs to authenticated;
grant select, insert, update, delete on public.meal_entries to authenticated;
grant select, insert on public.macro_entries to authenticated;
grant select on public.nutrition_log_totals to authenticated;
grant select on public.nutrition_log_totals_by_block to authenticated;
grant select on public.nutrition_log_remaining to authenticated;

do $$
begin
  if to_regclass('public.meal_symptoms') is not null then
    grant select, insert, delete on public.meal_symptoms to authenticated;
  end if;
end $$;

alter view if exists public.nutrition_log_totals set (security_invoker = true);
alter view if exists public.nutrition_log_totals_by_block set (security_invoker = true);
alter view if exists public.nutrition_log_remaining set (security_invoker = true);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nutrition_logs'
      and policyname = 'clients read own nutrition logs'
  ) then
    create policy "clients read own nutrition logs"
      on public.nutrition_logs
      for select
      to authenticated
      using ((select auth.uid()) = auth_user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nutrition_logs'
      and policyname = 'clients insert own nutrition logs'
  ) then
    create policy "clients insert own nutrition logs"
      on public.nutrition_logs
      for insert
      to authenticated
      with check (
        (select auth.uid()) = auth_user_id
        and exists (
          select 1
          from public.clients c
          where c.client_id = nutrition_logs.client_id
            and c.auth_user_id = (select auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'nutrition_logs'
      and policyname = 'clients update own nutrition logs'
  ) then
    create policy "clients update own nutrition logs"
      on public.nutrition_logs
      for update
      to authenticated
      using ((select auth.uid()) = auth_user_id)
      with check ((select auth.uid()) = auth_user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'foods'
      and policyname = 'authenticated read catalog and own foods'
  ) then
    create policy "authenticated read catalog and own foods"
      on public.foods
      for select
      to authenticated
      using (
        source = 'catalog'
        or auth_user_id = (select auth.uid())
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'food_nutrients'
      and policyname = 'authenticated read catalog and own food nutrients'
  ) then
    create policy "authenticated read catalog and own food nutrients"
      on public.food_nutrients
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.foods f
          where f.id = food_nutrients.food_id
            and (
              f.source = 'catalog'
              or f.auth_user_id = (select auth.uid())
            )
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'food_serving_options'
      and policyname = 'authenticated read catalog and own food servings'
  ) then
    create policy "authenticated read catalog and own food servings"
      on public.food_serving_options
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.foods f
          where f.id = food_serving_options.food_id
            and (
              f.source = 'catalog'
              or f.auth_user_id = (select auth.uid())
            )
        )
      );
  end if;
end $$;

do $$
begin
  if to_regclass('public.meal_symptoms') is not null then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'meal_symptoms'
        and policyname = 'clients read own meal symptoms'
    ) then
      execute $policy$
        create policy "clients read own meal symptoms"
          on public.meal_symptoms
          for select
          to authenticated
          using (
            exists (
              select 1
              from public.meal_entries me
              join public.nutrition_logs nl on nl.id = me.nutrition_log_id
              where me.id = meal_symptoms.meal_entry_id
                and nl.auth_user_id = (select auth.uid())
            )
          )
      $policy$;
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'meal_symptoms'
        and policyname = 'clients insert own meal symptoms'
    ) then
      execute $policy$
        create policy "clients insert own meal symptoms"
          on public.meal_symptoms
          for insert
          to authenticated
          with check (
            exists (
              select 1
              from public.meal_entries me
              join public.nutrition_logs nl on nl.id = me.nutrition_log_id
              where me.id = meal_symptoms.meal_entry_id
                and nl.auth_user_id = (select auth.uid())
            )
          )
      $policy$;
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'meal_symptoms'
        and policyname = 'clients delete own meal symptoms'
    ) then
      execute $policy$
        create policy "clients delete own meal symptoms"
          on public.meal_symptoms
          for delete
          to authenticated
          using (
            exists (
              select 1
              from public.meal_entries me
              join public.nutrition_logs nl on nl.id = me.nutrition_log_id
              where me.id = meal_symptoms.meal_entry_id
                and nl.auth_user_id = (select auth.uid())
            )
          )
      $policy$;
    end if;
  end if;
end $$;

create or replace function public.create_custom_food_with_nutrition(
  p_name text,
  p_brand text,
  p_default_serving_amount numeric,
  p_default_serving_unit text,
  p_grams_per_serving numeric,
  p_barcode text,
  p_barcode_format text,
  p_source text,
  p_client_id text,
  p_calories numeric,
  p_protein_g numeric,
  p_carbs_g numeric,
  p_fat_g numeric,
  p_fiber_g numeric,
  p_serving_label text
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_food_id uuid;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'Food name is required';
  end if;

  if coalesce(p_source, '') not in ('custom', 'barcode_custom') then
    raise exception 'Invalid custom food source';
  end if;

  if p_default_serving_amount is null or p_default_serving_amount <= 0 then
    raise exception 'Serving amount must be greater than zero';
  end if;

  if p_grams_per_serving is null or p_grams_per_serving <= 0 then
    raise exception 'Serving grams must be greater than zero';
  end if;

  if coalesce(p_calories, 0) < 0
    or coalesce(p_protein_g, 0) < 0
    or coalesce(p_carbs_g, 0) < 0
    or coalesce(p_fat_g, 0) < 0
    or coalesce(p_fiber_g, 0) < 0 then
    raise exception 'Nutrition values cannot be negative';
  end if;

  if not exists (
    select 1
    from public.clients c
    where c.client_id = p_client_id
      and c.auth_user_id = v_user_id
  ) then
    raise exception 'Client not found';
  end if;

  insert into public.foods (
    name,
    normalized_name,
    brand,
    default_serving_amount,
    default_serving_unit,
    grams_per_serving,
    barcode,
    barcode_format,
    source,
    client_id,
    auth_user_id
  )
  values (
    trim(p_name),
    lower(trim(p_name)),
    nullif(trim(p_brand), ''),
    p_default_serving_amount,
    nullif(trim(p_default_serving_unit), ''),
    p_grams_per_serving,
    nullif(trim(p_barcode), ''),
    nullif(trim(p_barcode_format), ''),
    p_source,
    p_client_id,
    v_user_id
  )
  returning id into v_food_id;

  insert into public.food_nutrients (
    food_id,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    fiber_g
  )
  values (
    v_food_id,
    coalesce(p_calories, 0),
    coalesce(p_protein_g, 0),
    coalesce(p_carbs_g, 0),
    coalesce(p_fat_g, 0),
    p_fiber_g
  );

  insert into public.food_serving_options (
    food_id,
    label,
    unit,
    grams,
    is_default,
    sort_order
  )
  values (
    v_food_id,
    coalesce(nullif(trim(p_serving_label), ''), p_default_serving_amount::text || ' ' || coalesce(nullif(trim(p_default_serving_unit), ''), 'serving')),
    coalesce(nullif(trim(p_default_serving_unit), ''), 'serving'),
    p_grams_per_serving,
    true,
    0
  );

  return v_food_id;
end;
$$;

revoke execute on function public.create_custom_food_with_nutrition(
  text,
  text,
  numeric,
  text,
  numeric,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  text
) from public, anon;

grant execute on function public.create_custom_food_with_nutrition(
  text,
  text,
  numeric,
  text,
  numeric,
  text,
  text,
  text,
  text,
  numeric,
  numeric,
  numeric,
  numeric,
  numeric,
  text
) to authenticated;

notify pgrst, 'reload schema';
