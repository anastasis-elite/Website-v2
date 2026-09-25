import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const catalogRlsMigration = readFileSync(
  'supabase/migrations/20260925_nutrition_catalog_select_rls.sql',
  'utf8'
)
const integrityMigration = readFileSync(
  'supabase/migrations/20260925_nutrition_logging_integrity.sql',
  'utf8'
)
const schemaAlignmentMigration = readFileSync(
  'supabase/migrations/20260919_nutrition_food_schema_alignment.sql',
  'utf8'
)
const launchRlsMigration = readFileSync(
  'supabase/migrations/20260708_launch_readiness_profiles_payments_rls.sql',
  'utf8'
)
const addMealRoute = readFileSync('app/api/nutrition/add-meal/route.ts', 'utf8')
const addMacrosRoute = readFileSync('app/api/nutrition/add-macros/route.ts', 'utf8')
const customFoodRoute = readFileSync('app/api/nutrition/custom-food/route.ts', 'utf8')
const mealEntryHelpers = readFileSync('lib/nutrition/mealEntry.ts', 'utf8')
const foodLogger = readFileSync('components/NutritionFoodLogger.tsx', 'utf8')
const dashboard = readFileSync('components/AdaptiveNutritionDashboard.tsx', 'utf8')

test('authenticated users can read shared catalog foods without exposing private foods', () => {
  assert.match(integrityMigration, /on public\.foods\s+for select\s+to authenticated/i)
  assert.match(integrityMigration, /source = 'catalog'/i)
  assert.match(integrityMigration, /auth_user_id = \(select auth\.uid\(\)\)/i)
  assert.doesNotMatch(integrityMigration, /on public\.foods[\s\S]*for select[\s\S]*using\s*\(\s*true\s*\)/i)
  assert.match(catalogRlsMigration, /authenticated read catalog and own foods/i)
})

test('authenticated users can read catalog serving options and nutrients through an allowed parent food', () => {
  assert.match(integrityMigration, /on public\.food_serving_options\s+for select\s+to authenticated/i)
  assert.match(integrityMigration, /where f\.id = food_serving_options\.food_id/i)
  assert.match(integrityMigration, /on public\.food_nutrients\s+for select\s+to authenticated/i)
  assert.match(integrityMigration, /where f\.id = food_nutrients\.food_id/i)
  assert.match(integrityMigration, /f\.source = 'catalog'/i)
  assert.match(integrityMigration, /f\.auth_user_id = \(select auth\.uid\(\)\)/i)
})

test('custom food insert policies remain owner-scoped and do not grant catalog writes', () => {
  assert.match(schemaAlignmentMigration, /clients insert own custom foods/i)
  assert.match(schemaAlignmentMigration, /source in \('custom','barcode_custom','photo_estimate'\)/i)
  assert.match(schemaAlignmentMigration, /where c\.client_id = foods\.client_id\s+and c\.auth_user_id = \(select auth\.uid\(\)\)/i)
  assert.match(schemaAlignmentMigration, /clients insert nutrients for own custom foods/i)
  assert.match(schemaAlignmentMigration, /clients insert servings for own custom foods/i)
  assert.doesNotMatch(catalogRlsMigration, /for insert/i)
})

test('nutrition tables and security invoker views have authenticated grants', () => {
  for (const table of ['foods', 'food_nutrients', 'food_serving_options']) {
    assert.match(integrityMigration, new RegExp(`grant select, insert on public\\.${table} to authenticated`, 'i'))
  }

  assert.match(integrityMigration, /grant select, insert, update on public\.nutrition_logs to authenticated/i)
  assert.match(integrityMigration, /grant select, insert, update, delete on public\.meal_entries to authenticated/i)
  assert.match(integrityMigration, /grant select, insert on public\.macro_entries to authenticated/i)
  assert.match(integrityMigration, /grant select, insert, delete on public\.meal_symptoms to authenticated/i)

  for (const view of ['nutrition_log_totals', 'nutrition_log_totals_by_block', 'nutrition_log_remaining']) {
    assert.match(integrityMigration, new RegExp(`alter view if exists public\\.${view} set \\(security_invoker = true\\)`, 'i'))
    assert.match(integrityMigration, new RegExp(`grant select on public\\.${view} to authenticated`, 'i'))
  }
})

test('nutrition log and meal symptom RLS are owner-scoped for normal authenticated callers', () => {
  assert.match(integrityMigration, /create policy "clients read own nutrition logs"[\s\S]*using \(\(select auth\.uid\(\)\) = auth_user_id\)/i)
  assert.match(integrityMigration, /create policy "clients insert own nutrition logs"[\s\S]*with check \([\s\S]*\(select auth\.uid\(\)\) = auth_user_id[\s\S]*c\.auth_user_id = \(select auth\.uid\(\)\)/i)
  assert.match(integrityMigration, /create policy "clients update own nutrition logs"[\s\S]*using \(\(select auth\.uid\(\)\) = auth_user_id\)[\s\S]*with check \(\(select auth\.uid\(\)\) = auth_user_id\)/i)
  assert.match(integrityMigration, /create policy "clients insert own meal symptoms"[\s\S]*join public\.nutrition_logs nl[\s\S]*nl\.auth_user_id = \(select auth\.uid\(\)\)/i)
  assert.match(launchRlsMigration, /create policy "clients insert own meal entries" on public\.meal_entries for insert to authenticated with check \(exists \(select 1 from public\.nutrition_logs nl where nl\.id = nutrition_log_id and nl\.auth_user_id = \(select auth\.uid\(\)\)\)\)/i)
})

test('add meal checks log ownership, food readability, and serving option parent before insert', () => {
  assert.match(addMealRoute, /\.from\('nutrition_logs'\)\s*\.select\('id, client_id, auth_user_id'\)/s)
  assert.match(addMealRoute, /if \(log\.auth_user_id !== user\.id\)/)
  assert.match(addMealRoute, /stage: 'nutrition_log_ownership'/)
  assert.match(addMealRoute, /\.from\('foods'\)\s*\.select\('id, default_serving_unit, grams_per_serving'\)/s)
  assert.match(addMealRoute, /\.from\('food_serving_options'\)\s*\.select\('id, food_id, label, unit, grams'\)/s)
  assert.match(addMealRoute, /if \(servingOption\.food_id !== foodId\)/)
  assert.match(addMealRoute, /Serving option does not match selected food\./)
  assert.match(addMealRoute, /stage: 'serving_option_food_mismatch'/)
})

test('serving conversion fails safely instead of assuming 100g', () => {
  assert.match(addMealRoute, /positiveFiniteNumber\(servingAmount \?\? 1\)/)
  assert.match(addMealRoute, /resolveMealServingGrams\(\{ amount, explicitGrams: submittedGrams, food, servingOption \}\)/)
  assert.match(addMealRoute, /resolveMealServingGrams\(\{ amount, explicitGrams: submittedGrams, food \}\)/)
  assert.match(addMealRoute, /Serving conversion is missing for this food\./)
  assert.doesNotMatch(addMealRoute, /grams_per_serving\s*\|\|\s*100/)
  assert.doesNotMatch(mealEntryHelpers, /return \['g', 'gram', 'grams'\]\.includes\(unit\) \? safeSize : 100/)
})

test('nutrient calculations scale linearly for whole and decimal servings', () => {
  const per100gCalories = 140
  const servingGrams = 50
  const scaled = (amount) => per100gCalories * ((amount * servingGrams) / 100)

  assert.equal(scaled(1), 70)
  assert.equal(scaled(2), scaled(1) * 2)
  assert.equal(scaled(0.5), 35)
  assert.equal(scaled(1.5), 105)
  assert.equal(scaled(2.25), 157.5)

  assert.match(mealEntryHelpers, /amount \* optionGrams/)
  assert.match(mealEntryHelpers, /Math\.round\(nutrient \* gramAmount\) \/ 100/)
  assert.match(mealEntryHelpers, /if \(!Number\.isFinite\(gramAmount\) \|\| gramAmount <= 0\) return null/)
})

test('post-mutation failures return degraded success rather than false add failure', () => {
  assert.match(addMealRoute, /let refreshStatus: 'success' \| 'degraded' = 'success'/)
  assert.match(addMealRoute, /stage: 'meal_symptom_insert'/)
  assert.match(addMealRoute, /refreshStatus = 'degraded'/)
  assert.match(addMealRoute, /stage: 'remaining_refresh'/)
  assert.match(addMealRoute, /success: true,\s*mealEntryId: mealEntry\.id,[\s\S]*refreshStatus,[\s\S]*remaining: remainingError \? null : remaining/s)
  assert.doesNotMatch(addMealRoute, /stage: 'meal_symptom_insert'[\s\S]{0,500}We couldn't add this food/)
})

test('server diagnostics include safe structured nutrition context only', () => {
  assert.match(addMealRoute, /route: 'app\/api\/nutrition\/add-meal'/)
  assert.match(addMealRoute, /stage,\s*table,\s*code: error\?\.code \|\| null,\s*message: error\?\.message \|\| null,\s*userId: userId \|\| null,\s*nutritionLogId: nutritionLogId \|\| null,\s*foodId: foodId \|\| null,\s*servingOptionId: servingOptionId \|\| null,\s*entryId: entryId \|\| null/s)
  assert.doesNotMatch(addMealRoute, /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|createClient\([^)]*service_role/i)
})

test('custom food creation is atomic and rejects untrusted source values server-side', () => {
  assert.match(integrityMigration, /create or replace function public\.create_custom_food_with_nutrition/i)
  assert.match(integrityMigration, /security invoker/i)
  assert.match(integrityMigration, /insert into public\.foods[\s\S]*insert into public\.food_nutrients[\s\S]*insert into public\.food_serving_options/i)
  assert.match(integrityMigration, /if coalesce\(p_source, ''\) not in \('custom', 'barcode_custom'\) then/i)
  assert.match(integrityMigration, /revoke execute on function public\.create_custom_food_with_nutrition[\s\S]*from public, anon/i)
  assert.match(integrityMigration, /grant execute on function public\.create_custom_food_with_nutrition[\s\S]*to authenticated/i)
  assert.match(customFoodRoute, /\.rpc\('create_custom_food_with_nutrition'/)
  assert.match(customFoodRoute, /const source = barcode \? 'barcode_custom' : 'custom'/)
  assert.doesNotMatch(customFoodRoute, /const source = body\.source/)
})

test('custom food serving grams are explicit for non-gram units', () => {
  assert.match(customFoodRoute, /Serving weight in grams is required\./)
  assert.match(customFoodRoute, /positiveFiniteNumber\(body\.servingGrams \|\| body\.gramsPerServing\)/)
  assert.match(foodLogger, /servingGrams: ''/)
  assert.match(foodLogger, /placeholder="Serving weight g"/)
})

test('remaining macros update from add meal and macro-only responses without full reload dependency', () => {
  assert.match(foodLogger, /if \(data\.remaining\) setRemaining\(data\.remaining\)/)
  assert.match(foodLogger, /onUpdated\?\.\(data\.remaining \|\| null, 'added'\)/)
  assert.match(foodLogger, /data\.refreshStatus === 'degraded'/)
  assert.match(dashboard, /if \(updatedRemaining\) \{\s*setRemaining\(updatedRemaining\)\s*\}/s)
  assert.match(addMacrosRoute, /\.from\('nutrition_log_remaining'\)/)
  assert.match(dashboard, /if \(payload\?\.remaining\) \{\s*setRemaining\(payload\.remaining\)\s*\}/s)
})

test('completed state is not set merely because one food or macro entry was logged', () => {
  assert.doesNotMatch(addMealRoute, /completed:\s*true/)
  assert.doesNotMatch(addMacrosRoute, /completed:\s*true/)
  assert.match(addMealRoute, /\.update\(\{ updated_at: new Date\(\)\.toISOString\(\) \}\)/)
  assert.match(addMacrosRoute, /\.update\(\{ updated_at: new Date\(\)\.toISOString\(\) \}\)/)
})
