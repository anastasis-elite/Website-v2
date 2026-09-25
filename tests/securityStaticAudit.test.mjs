import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

function read(path) {
  return readFileSync(path, 'utf8')
}

test('program APIs do not use service-role clients or trust client_id alone', () => {
  for (const path of [
    'app/api/program/generate/route.ts',
    'app/api/program/workout/route.ts',
  ]) {
    const source = read(path)
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|@supabase\/supabase-js/)
    assert.match(source, /auth\.getUser\(\)/)
    assert.match(source, /\.eq\('auth_user_id', user\.id\)/)
  }
})

test('nutrition target API does not return proprietary calculation internals', () => {
  const source = read('app/api/nutrition/route.ts')
  for (const leakedField of [
    'nutritionCalculation',
    'defaultMacroPercentages',
    'finalMacroPercentages',
    'goalModifier',
    'activityFactor',
    'bmr:',
    'estimatedTdee:',
    'safeguardsApplied',
  ]) {
    assert.doesNotMatch(source, new RegExp(leakedField))
  }
  assert.match(source, /auth\.getUser\(\)/)
  assert.match(source, /\.eq\('auth_user_id', user\.id\)/)
})

test('security headers and browser source map hardening are configured', () => {
  const source = read('next.config.js')
  assert.match(source, /productionBrowserSourceMaps:\s*false/)
  assert.match(source, /Content-Security-Policy/)
  assert.match(source, /frame-ancestors 'none'/)
  assert.match(source, /X-Content-Type-Options/)
  assert.match(source, /Strict-Transport-Security/)
})

test('database hardening migration keeps assessment storage private', () => {
  const source = read('supabase/migrations/20260923_security_hardening.sql')
  assert.match(source, /update storage\.buckets\s+set public = false\s+where id = 'assessment_photos'/i)
  assert.match(source, /revoke execute on function public\.prevent_compliance_record_mutation\(\) from public, anon, authenticated/i)
  assert.match(source, /force row level security/i)
})

test('micronutrient and supplement intelligence tables keep RLS enabled', () => {
  const source = read('supabase/migrations/20260925_micronutrient_intelligence_layer.sql')
  for (const table of [
    'nutrient_function_map',
    'supplements',
    'supplement_ingredients',
    'ingredient_nutrients',
    'supplement_supported_functions',
    'client_nutrient_intake_exposures',
    'client_nutrient_recommendations',
  ]) {
    assert.match(source, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
  }
  assert.match(source, /clients read own nutrient exposures/i)
  assert.match(source, /clients read own nutrient recommendations/i)
})

test('proprietary reference APIs require server-side admin authorization', () => {
  for (const path of [
    'app/api/reference/master-key/route.ts',
    'app/api/reference/hypertrophy-chart/route.ts',
    'app/api/reference/program-reference/route.ts',
  ]) {
    const source = read(path)
    assert.match(source, /getAOSAdminUser/)
    assert.match(source, /status:\s*404/)
  }
})
