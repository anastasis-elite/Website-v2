-- Suggested Foods can rank macros from the existing foods table immediately.
-- These nullable nutrient columns let the same scoring path use micronutrient
-- data when the food source has it, without changing target calculations.

alter table public.foods
  add column if not exists allergens text[] not null default '{}',
  add column if not exists fiber_g numeric check (fiber_g is null or fiber_g >= 0),
  add column if not exists sodium_mg numeric check (sodium_mg is null or sodium_mg >= 0),
  add column if not exists potassium_mg numeric check (potassium_mg is null or potassium_mg >= 0),
  add column if not exists magnesium_mg numeric check (magnesium_mg is null or magnesium_mg >= 0),
  add column if not exists calcium_mg numeric check (calcium_mg is null or calcium_mg >= 0),
  add column if not exists iron_mg numeric check (iron_mg is null or iron_mg >= 0),
  add column if not exists zinc_mg numeric check (zinc_mg is null or zinc_mg >= 0),
  add column if not exists selenium_mcg numeric check (selenium_mcg is null or selenium_mcg >= 0),
  add column if not exists choline_mg numeric check (choline_mg is null or choline_mg >= 0),
  add column if not exists vitamin_a_mcg numeric check (vitamin_a_mcg is null or vitamin_a_mcg >= 0),
  add column if not exists vitamin_c_mg numeric check (vitamin_c_mg is null or vitamin_c_mg >= 0),
  add column if not exists vitamin_d_mcg numeric check (vitamin_d_mcg is null or vitamin_d_mcg >= 0),
  add column if not exists vitamin_e_mg numeric check (vitamin_e_mg is null or vitamin_e_mg >= 0),
  add column if not exists vitamin_k_mcg numeric check (vitamin_k_mcg is null or vitamin_k_mcg >= 0),
  add column if not exists b1_mg numeric check (b1_mg is null or b1_mg >= 0),
  add column if not exists b2_mg numeric check (b2_mg is null or b2_mg >= 0),
  add column if not exists b3_mg numeric check (b3_mg is null or b3_mg >= 0),
  add column if not exists b5_mg numeric check (b5_mg is null or b5_mg >= 0),
  add column if not exists b6_mg numeric check (b6_mg is null or b6_mg >= 0),
  add column if not exists b9_mcg numeric check (b9_mcg is null or b9_mcg >= 0),
  add column if not exists b12_mcg numeric check (b12_mcg is null or b12_mcg >= 0);
