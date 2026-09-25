-- Allow authenticated app users to read shared nutrition catalog rows while
-- preserving ownership boundaries for private/custom foods.

grant select on public.foods to authenticated;
grant select on public.food_nutrients to authenticated;
grant select on public.food_serving_options to authenticated;

do $$
begin
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

notify pgrst, 'reload schema';
