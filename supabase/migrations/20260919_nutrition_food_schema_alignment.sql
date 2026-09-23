-- Align food logging with the normalized food catalog schema.
-- Canonical brand storage is public.foods.brand.
-- Canonical nutrition storage is public.food_nutrients per 100 grams.

alter table public.foods
  add column if not exists brand text,
  add column if not exists barcode text,
  add column if not exists barcode_format text,
  add column if not exists source text not null default 'catalog',
  add column if not exists client_id text references public.clients(client_id) on delete cascade,
  add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'foods'
      and column_name = 'brand_name'
  ) then
    execute 'update public.foods set brand = coalesce(brand, brand_name) where brand_name is not null';
    execute 'alter table public.foods drop column brand_name';
  end if;
end $$;

create unique index if not exists foods_barcode_unique_idx
  on public.foods (barcode)
  where barcode is not null;

create index if not exists foods_client_created_idx
  on public.foods (client_id, created_at desc)
  where client_id is not null;

alter table public.foods enable row level security;
alter table public.food_nutrients enable row level security;
alter table public.food_serving_options enable row level security;

grant select, insert on public.foods to authenticated;
grant select, insert on public.food_nutrients to authenticated;
grant select, insert on public.food_serving_options to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'foods'
      and policyname = 'clients insert own custom foods'
  ) then
    create policy "clients insert own custom foods"
      on public.foods for insert to authenticated
      with check (
        (select auth.uid()) = auth_user_id
        and source in ('custom','barcode_custom','photo_estimate')
        and exists (
          select 1 from public.clients c
          where c.client_id = foods.client_id
            and c.auth_user_id = (select auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'food_nutrients'
      and policyname = 'clients insert nutrients for own custom foods'
  ) then
    create policy "clients insert nutrients for own custom foods"
      on public.food_nutrients for insert to authenticated
      with check (
        exists (
          select 1 from public.foods f
          where f.id = food_nutrients.food_id
            and f.auth_user_id = (select auth.uid())
            and f.source in ('custom','barcode_custom','photo_estimate')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'food_serving_options'
      and policyname = 'clients insert servings for own custom foods'
  ) then
    create policy "clients insert servings for own custom foods"
      on public.food_serving_options for insert to authenticated
      with check (
        exists (
          select 1 from public.foods f
          where f.id = food_serving_options.food_id
            and f.auth_user_id = (select auth.uid())
            and f.source in ('custom','barcode_custom','photo_estimate')
        )
      );
  end if;
end $$;

notify pgrst, 'reload schema';
