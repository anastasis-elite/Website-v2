create table if not exists public.recipes (
  id text primary key,
  title text not null,
  description text,
  image_url text,
  servings numeric not null default 1 check (servings > 0),
  prep_minutes integer not null default 0 check (prep_minutes >= 0),
  cook_minutes integer not null default 0 check (cook_minutes >= 0),
  total_minutes integer not null default 0 check (total_minutes >= 0),
  ingredients jsonb not null default '[]'::jsonb,
  instructions jsonb not null default '[]'::jsonb,
  calories integer not null default 0 check (calories >= 0),
  protein_g numeric not null default 0 check (protein_g >= 0),
  carbs_g numeric not null default 0 check (carbs_g >= 0),
  fat_g numeric not null default 0 check (fat_g >= 0),
  fiber_g numeric check (fiber_g is null or fiber_g >= 0),
  meal_type text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  tags text[] not null default '{}',
  dietary_tags text[] not null default '{}',
  allergens text[] not null default '{}',
  cuisine text,
  difficulty text not null default 'easy' check (difficulty in ('easy','moderate')),
  substitutions jsonb not null default '[]'::jsonb,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_recipe_favorites (
  client_id text not null references public.clients(client_id) on delete cascade,
  recipe_id text not null references public.recipes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, recipe_id)
);

alter table public.recipes enable row level security;
alter table public.client_recipe_favorites enable row level security;

create policy "Authenticated users can read active recipes"
  on public.recipes for select to authenticated
  using (active = true);

create policy "Clients read own recipe favorites"
  on public.client_recipe_favorites for select to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.client_id = client_recipe_favorites.client_id
        and c.auth_user_id = (select auth.uid())
    )
  );

create policy "Clients insert own recipe favorites"
  on public.client_recipe_favorites for insert to authenticated
  with check (
    exists (
      select 1 from public.clients c
      where c.client_id = client_recipe_favorites.client_id
        and c.auth_user_id = (select auth.uid())
    )
  );

create policy "Clients delete own recipe favorites"
  on public.client_recipe_favorites for delete to authenticated
  using (
    exists (
      select 1 from public.clients c
      where c.client_id = client_recipe_favorites.client_id
        and c.auth_user_id = (select auth.uid())
    )
  );

grant select on public.recipes to authenticated;
grant select, insert, delete on public.client_recipe_favorites to authenticated;

alter table public.meal_entries
  add column if not exists recipe_id text references public.recipes(id),
  add column if not exists recipe_servings numeric check (recipe_servings is null or recipe_servings > 0);

insert into public.recipes (
  id,title,description,servings,prep_minutes,cook_minutes,total_minutes,ingredients,instructions,
  calories,protein_g,carbs_g,fat_g,fiber_g,meal_type,tags,dietary_tags,allergens,cuisine,difficulty,substitutions
) values
  (
    'protein-yogurt-berry-bowl','Protein Yogurt Berry Bowl','A fast breakfast with Greek yogurt, berries, oats, and seeds.',
    1,6,0,6,
    '[{"name":"Greek yogurt","quantity":"1 cup"},{"name":"Berries","quantity":"1 cup"},{"name":"Rolled oats","quantity":"1/3 cup"},{"name":"Chia seeds","quantity":"1 tbsp"}]'::jsonb,
    '["Add yogurt to a bowl.","Top with berries, oats, and chia.","Stir or leave layered."]'::jsonb,
    360,34,42,8,9,'breakfast',
    array['protein-forward','quick','no-cook'],array['vegetarian'],array['dairy'],'general','easy',
    '["Use dairy-free high-protein yogurt if needed."]'::jsonb
  ),
  (
    'chicken-rice-lunch-bowl','Chicken Rice Lunch Bowl','A practical lunch bowl built from chicken, rice, vegetables, and sauce.',
    1,10,5,15,
    '[{"name":"Cooked chicken breast","quantity":"5 oz"},{"name":"Cooked rice","quantity":"1 cup"},{"name":"Mixed vegetables","quantity":"1 cup"},{"name":"Olive oil or sauce","quantity":"1 tbsp"}]'::jsonb,
    '["Warm rice and vegetables.","Add chicken.","Finish with sauce and season to taste."]'::jsonb,
    520,44,58,14,6,'lunch',
    array['protein-forward','meal-prep','post-workout'],array[]::text[],array[]::text[],'general','easy',
    '[]'::jsonb
  ),
  (
    'turkey-potato-comfort-skillet','Turkey Potato Comfort Skillet','A warm dinner with lean turkey, potatoes, vegetables, and broth.',
    2,10,20,30,
    '[{"name":"Lean ground turkey","quantity":"12 oz"},{"name":"Diced potatoes","quantity":"2 cups"},{"name":"Frozen vegetables","quantity":"2 cups"},{"name":"Broth","quantity":"1/2 cup"}]'::jsonb,
    '["Brown turkey in a skillet.","Add potatoes and broth; cover until tender.","Stir in vegetables and season."]'::jsonb,
    455,35,46,15,7,'dinner',
    array['comfort','protein-forward','easy-dinner'],array[]::text[],array[]::text[],'general','easy',
    '[]'::jsonb
  ),
  (
    'cottage-cheese-crunch-plate','Cottage Cheese Crunch Plate','A snack plate with cottage cheese, fruit, and whole-grain crackers.',
    1,5,0,5,
    '[{"name":"Cottage cheese","quantity":"3/4 cup"},{"name":"Fruit","quantity":"1 serving"},{"name":"Whole-grain crackers","quantity":"1 serving"}]'::jsonb,
    '["Add cottage cheese to a bowl or plate.","Pair with fruit and crackers.","Season sweet or savory."]'::jsonb,
    310,28,34,8,5,'snack',
    array['snack','quick','protein-forward'],array['vegetarian'],array['dairy','gluten'],'general','easy',
    '["Use tuna, tofu dip, or hummus if avoiding dairy."]'::jsonb
  )
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  servings = excluded.servings,
  prep_minutes = excluded.prep_minutes,
  cook_minutes = excluded.cook_minutes,
  total_minutes = excluded.total_minutes,
  ingredients = excluded.ingredients,
  instructions = excluded.instructions,
  calories = excluded.calories,
  protein_g = excluded.protein_g,
  carbs_g = excluded.carbs_g,
  fat_g = excluded.fat_g,
  fiber_g = excluded.fiber_g,
  meal_type = excluded.meal_type,
  tags = excluded.tags,
  dietary_tags = excluded.dietary_tags,
  allergens = excluded.allergens,
  substitutions = excluded.substitutions,
  updated_at = now();
