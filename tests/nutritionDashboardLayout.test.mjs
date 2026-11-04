import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const dashboard = readFileSync('components/AdaptiveNutritionDashboard.tsx', 'utf8')
const foodLogger = readFileSync('components/NutritionFoodLogger.tsx', 'utf8')
const deleteMealRoute = readFileSync('app/api/nutrition/delete-meal/route.ts', 'utf8')
const suggestedFoodsRoute = readFileSync('app/api/nutrition/suggested-foods/route.ts', 'utf8')
const suggestedFoodsLogic = readFileSync('lib/nutrition/suggestedFoods.ts', 'utf8')
const targetService = readFileSync('lib/nutrition/targetService.ts', 'utf8')
const nutritionTargetMigration = readFileSync('supabase/migrations/20260825_nutrition_target_engine.sql', 'utf8')
const css = readFileSync('app/globals.css', 'utf8')

test('nutrition dashboard combines daily progress with targets while retaining entitled intake and management panels', () => {
  assert.match(dashboard, /phone-app-targets nutrition-daily-targets/)
  assert.doesNotMatch(dashboard, /data-testid="nutrition-objective"|data-testid="nutrition-progress-panel"/)
  assert.match(dashboard, /data-testid="nutrition-intake-panel"/)
  assert.match(dashboard, /data-testid="nutrition-management-panel"/)
  assert.match(dashboard, /className="nutrition-progress-grid"/)
})

test('nutrition dashboard keeps higher-tier food and micronutrient tools without duplicate trends or goals', () => {
  assert.doesNotMatch(dashboard, /type ProgressTab|nutrition-trends-tab|nutrition-goals-assessment-tab|Goals \/ Assessment/)
  assert.match(dashboard, /type IntakeTab = 'water' \| 'meal' \| 'suggested'/)
  assert.match(dashboard, /type ManagementTab = 'micros' \| 'recipes'/)
  assert.match(dashboard, /data-testid="nutrition-suggested-foods-tab"/)
  assert.match(dashboard, /Suggested Foods/)
  assert.match(dashboard, /className="tier-tab-list nutrition-panel-tabs"/)
  assert.match(dashboard, /className="tier-tab-list nutrition-management-tabs"/)
  assert.match(readFileSync('app/dashboard/progress/page.tsx', 'utf8'), /<TrendsTab logic=\{logic\}/)
})

test('nutrition dashboard reuses existing nutrition data and logging components', () => {
  assert.match(dashboard, /NutritionFoodLogger/)
  assert.match(readFileSync('components/hydration/HydrationQuickAdd.tsx', 'utf8'), /fetch\('\/api\/nutrition\/add-water'/)
  assert.match(readFileSync('components/nutrition/MacroQuickAdd.tsx', 'utf8'), /fetch\('\/api\/nutrition\/add-macros'/)
  assert.match(dashboard, /\/api\/nutrition\/suggested-foods\?nutritionLogId=/)
  assert.match(dashboard, /nutrition_log_remaining/)
  assert.doesNotMatch(dashboard, /logic\.trends\.filter/)
  assert.doesNotMatch(dashboard, /Math\.random|placeholder/i)
})

test('suggested foods reuse current remaining nutrition and food log data', () => {
  assert.match(suggestedFoodsRoute, /\.from\('nutrition_log_remaining'\)/)
  assert.match(suggestedFoodsRoute, /\.from\('meal_entries'\)/)
  assert.match(suggestedFoodsRoute, /\.from\('foods'\)/)
  assert.match(suggestedFoodsRoute, /buildSuggestedFoods/)
  assert.match(suggestedFoodsRoute, /basis: memberRemaining/)
  assert.doesNotMatch(suggestedFoodsRoute, /state: 'needs_logs'/)
  assert.match(suggestedFoodsRoute, /state: 'complete'/)
  assert.match(suggestedFoodsLogic, /protein_remaining_g/)
  assert.match(suggestedFoodsLogic, /potassium_remaining_mg/)
  assert.match(suggestedFoodsLogic, /magnesium_remaining_mg/)
  assert.match(suggestedFoodsLogic, /loggedFoodIds/)
  assert.match(suggestedFoodsLogic, /avoidTerms/)
  assert.match(suggestedFoodsRoute, /avoidTermsFromClient/)
  assert.match(suggestedFoodsLogic, /carbsRemaining <= 8/)
  assert.match(suggestedFoodsLogic, /fatsRemaining <= 5/)
})

test('removing food propagates authoritative recalculated nutrition totals', () => {
  assert.match(deleteMealRoute, /\.from\('meal_entries'\)\s*\.delete\(\)/s)
  assert.match(deleteMealRoute, /\.from\('nutrition_log_remaining'\)/)
  assert.match(deleteMealRoute, /remainingError/)
  assert.match(deleteMealRoute, /updated_at: new Date\(\)\.toISOString\(\)/)
  assert.match(foodLogger, /onUpdated\?\.\(data\.remaining \|\| null, 'removed'\)/)
  assert.match(foodLogger, /useEffect\(\(\) => \{\s*setRemaining\(initialRemaining\)/s)
  assert.match(dashboard, /handleFoodUpdated\(updatedRemaining\?: Remaining \| null, action: 'added' \| 'removed'/)
  assert.match(dashboard, /setRemaining\(memberNutritionRemaining\(updatedRemaining, tier\)\)/)
  ;[
    'fiber_remaining_g',
    'sodium_remaining_mg',
    'potassium_remaining_mg',
    'magnesium_remaining_mg',
    'calcium_remaining_mg',
    'iron_remaining_mg',
    'zinc_remaining_mg',
    'selenium_remaining_mcg',
    'choline_remaining_mg',
    'vitamin_a_remaining_mcg',
    'vitamin_c_remaining_mg',
    'vitamin_d_remaining_mcg',
    'vitamin_e_remaining_mg',
    'vitamin_k_remaining_mcg',
    'b1_remaining_mg',
    'b2_remaining_mg',
    'b3_remaining_mg',
    'b5_remaining_mg',
    'b6_remaining_mg',
    'b9_remaining_mcg',
    'b12_remaining_mcg',
  ].forEach((key) => assert.match(dashboard, new RegExp(`${key}: remaining\\.${key}`)))
})

test('nutrition target audit does not require a bmr_kcal nutrition_logs column', () => {
  assert.doesNotMatch(targetService, /bmr_kcal/)
  assert.doesNotMatch(nutritionTargetMigration, /bmr_kcal/)
  assert.doesNotMatch(nutritionTargetMigration, /alter table public\.nutrition_logs/)
  assert.match(targetService, /export function nutritionLogAuditFields\(target: NutritionTargetResult\) \{\s*void target\s*return \{\}\s*\}/s)
})
