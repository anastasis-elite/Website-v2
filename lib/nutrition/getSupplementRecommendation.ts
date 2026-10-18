import { isAOSAdmin } from '@/lib/aos/isAOSAdmin'
import { canTrackMicronutrients } from '@/lib/nutrition/memberNutrition'
import {
  DEFAULT_SUPPLEMENT_RECOMMENDATION_CONFIG,
  SUPPLEMENT_RECOMMENDATION_ENGINE_VERSION,
  evaluateSupplementRecommendation,
  type FormulationDefinition,
  type FunctionalTrendInput,
  type NutrientCoverageDay,
  type SafetyContext,
  type SupplementRecommendationConfig,
  type SupplementRecommendationResult,
  type SupplementSupportCategory,
} from '@/lib/nutrition/supplementRecommendationEngine'

type SupabaseClient = {
  from(table: string): any
}

const nutrientFields: Record<string, { remaining: string; target: string; unit: string; name: string }> = {
  protein: { remaining: 'protein_remaining_g', target: 'protein', unit: 'g', name: 'Protein' },
  magnesium: { remaining: 'magnesium_remaining_mg', target: 'magnesium_target_mg', unit: 'mg', name: 'Magnesium' },
  calcium: { remaining: 'calcium_remaining_mg', target: 'calcium_target_mg', unit: 'mg', name: 'Calcium' },
  potassium: { remaining: 'potassium_remaining_mg', target: 'potassium_target_mg', unit: 'mg', name: 'Potassium' },
  iron: { remaining: 'iron_remaining_mg', target: 'iron_target_mg', unit: 'mg', name: 'Iron' },
  zinc: { remaining: 'zinc_remaining_mg', target: 'zinc_target_mg', unit: 'mg', name: 'Zinc' },
  vitamin_c: { remaining: 'vitamin_c_remaining_mg', target: 'vitamin_c_target_mg', unit: 'mg', name: 'Vitamin C' },
  vitamin_d: { remaining: 'vitamin_d_remaining_mcg', target: 'vitamin_d_target_mcg', unit: 'mcg', name: 'Vitamin D' },
  b6: { remaining: 'b6_remaining_mg', target: 'b6_target_mg', unit: 'mg', name: 'Vitamin B6' },
  b9: { remaining: 'b9_remaining_mcg', target: 'b9_target_mcg', unit: 'mcg', name: 'Folate' },
  b12: { remaining: 'b12_remaining_mcg', target: 'b12_target_mcg', unit: 'mcg', name: 'Vitamin B12' },
}

const functionCategoryMap: Record<string, SupplementSupportCategory> = {
  sleep: 'sleep_support',
  sleep_quality: 'sleep_support',
  recovery: 'recovery_support',
  recovery_support: 'recovery_support',
  muscle_function: 'muscle_function',
  energy: 'energy_support',
  stress: 'stress_resilience',
  nervous_system: 'stress_resilience',
  cycle: 'cycle_support',
  menstrual: 'cycle_support',
  general_nutrition: 'general_nutrition',
}

function numeric(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

function supportCategory(value: unknown): SupplementSupportCategory {
  return functionCategoryMap[String(value || '').toLowerCase()] || 'general_nutrition'
}

function consumed(log: Record<string, unknown>, remaining: Record<string, unknown> | null, key: string) {
  const fields = nutrientFields[key]
  const target = numeric(log[fields.target])
  const left = numeric(remaining?.[fields.remaining])
  if (target === null || target <= 0 || left === null) return { intake: null, target }
  return { intake: Math.max(0, target - left), target }
}

async function safeQuery<T>(query: PromiseLike<{ data: T | null; error: any }>, fallback: T): Promise<T> {
  const { data, error } = await query
  if (error) return fallback
  return data ?? fallback
}

function buildCoverageDays(logs: any[], remainingRows: any[], mealEntries: any[], macroEntries: any[], keys = Object.keys(nutrientFields)) {
  const remainingByLog = new Map<string, any>((remainingRows || []).map((row) => [String(row.nutrition_log_id), row]))
  const mealCountByLog = new Map<string, number>()
  for (const entry of mealEntries || []) mealCountByLog.set(String(entry.nutrition_log_id), (mealCountByLog.get(String(entry.nutrition_log_id)) || 0) + 1)
  for (const entry of macroEntries || []) mealCountByLog.set(String(entry.nutrition_log_id), (mealCountByLog.get(String(entry.nutrition_log_id)) || 0) + 1)

  const coverageDays: NutrientCoverageDay[] = []
  for (const log of logs || []) {
    const logId = String(log.id)
    const remaining = remainingByLog.get(logId) || null
    const adequatelyLogged = Boolean(log.completed || (mealCountByLog.get(logId) || 0) > 0)
    for (const key of keys) {
      const fields = nutrientFields[key]
      const day = consumed(log, remaining, key)
      coverageDays.push({
        date: String(log.log_date),
        nutrientKey: key,
        nutrientName: fields.name,
        estimatedDailyIntake: day.intake,
        referenceTarget: day.target,
        unit: fields.unit,
        adequatelyLogged,
      })
    }
  }
  return coverageDays
}

function buildFunctionalInputs(recoveryLogs: any[], cycleSymptoms: any[]) {
  const inputs: FunctionalTrendInput[] = []
  for (const row of recoveryLogs || []) {
    const date = String(row.log_date)
    inputs.push({ category: 'sleep_support', date, value: numeric(row.sleep_quality), higherIsBetter: true })
    inputs.push({ category: 'energy_support', date, value: numeric(row.energy_level), higherIsBetter: true })
    inputs.push({ category: 'recovery_support', date, value: numeric(row.soreness_level), higherIsBetter: false })
    inputs.push({ category: 'stress_resilience', date, value: numeric(row.stress_level), higherIsBetter: false })
  }
  for (const row of cycleSymptoms || []) {
    const date = String(row.log_date)
    inputs.push({ category: 'energy_support', date, value: numeric(row.energy), higherIsBetter: true })
    inputs.push({ category: 'recovery_support', date, value: numeric(row.training_readiness), higherIsBetter: true })
  }
  return inputs
}

function buildSafetyContext(client: any, activeRecommendations: any[], upperIntakeConcernNutrients: string[]): SafetyContext {
  const reproductiveStatus = String(client?.reproductive_status || '').toLowerCase()
  const freeText = [
    client?.medical_conditions,
    client?.medications,
    client?.injuries,
    client?.limitations,
    client?.six_month_cycle_status,
  ].join(' ').toLowerCase()

  return {
    pregnancyOrBreastfeeding: ['pregnant', 'breastfeeding', 'nursing'].includes(reproductiveStatus) || /pregnan|breastfeed|nursing/.test(freeText),
    medicationInteractionConcern: /medication|ssri|blood thinner|thyroid|antidepress|birth control|hormone|\bhrt\b/.test(freeText),
    diagnosedConditionConcern: /diagnos|condition|kidney|liver|heart|thyroid|autoimmune|hypertension/.test(freeText),
    knownIngredientAllergies: String(client?.allergies || '').split(',').map((item) => item.trim()).filter(Boolean),
    contraindicationConcern: /contraindicat|medical supervision|under care/.test(freeText),
    upperIntakeConcernNutrients,
    recentlyResolvedProductIds: (activeRecommendations || [])
      .filter((row) => row.resolved_at && Date.now() - new Date(row.resolved_at).getTime() < DEFAULT_SUPPLEMENT_RECOMMENDATION_CONFIG.recentlyResolvedDays * 86400000)
      .map((row) => String(row.supplement_id)),
  }
}

function buildFormulations(rows: {
  supplements: any[]
  ingredients: any[]
  ingredientNutrients: any[]
  supportedFunctions: any[]
}) {
  const ingredientsBySupplement = new Map<string, any[]>()
  for (const ingredient of rows.ingredients || []) {
    const supplementId = String(ingredient.supplement_id)
    ingredientsBySupplement.set(supplementId, [...(ingredientsBySupplement.get(supplementId) || []), ingredient])
  }
  const nutrientByIngredient = new Map<string, string[]>()
  for (const item of rows.ingredientNutrients || []) {
    const ingredientId = String(item.supplement_ingredient_id)
    const nutrientKey = item.nutrients?.nutrient_key
    if (nutrientKey) nutrientByIngredient.set(ingredientId, [...(nutrientByIngredient.get(ingredientId) || []), String(nutrientKey)])
  }
  const functionsBySupplement = new Map<string, SupplementSupportCategory[]>()
  for (const item of rows.supportedFunctions || []) {
    const supplementId = String(item.supplement_id)
    functionsBySupplement.set(supplementId, [...(functionsBySupplement.get(supplementId) || []), supportCategory(item.function_key)])
  }

  return (rows.supplements || []).map((supplement): FormulationDefinition => {
    const supplementId = String(supplement.id)
    const nutrients = new Set<string>()
    for (const ingredient of ingredientsBySupplement.get(supplementId) || []) {
      nutrients.add(String(ingredient.ingredient_key))
      for (const key of nutrientByIngredient.get(String(ingredient.id)) || []) nutrients.add(key)
    }

    return {
      productId: supplementId,
      productName: String(supplement.product_name),
      active: String(supplement.status || '').toLowerCase() === 'active',
      productUrl: supplement.product_url || null,
      nutrients: Array.from(nutrients),
      supportCategories: Array.from(new Set(functionsBySupplement.get(supplementId) || ['general_nutrition'])),
      contraindicationMetadata: supplement.contraindication_metadata || null,
      recommendationCopy: supplement.recommendation_copy || null,
      disclaimerCopy: supplement.disclaimer_copy || null,
      minimumMatchingRequirements: supplement.minimum_matching_requirements || null,
    }
  })
}

async function loadConfig(supabase: SupabaseClient): Promise<SupplementRecommendationConfig> {
  const rows = await safeQuery<any[]>(
    supabase.from('supplement_recommendation_engine_config').select('config_key,config_value'),
    [],
  )
  return rows.reduce((config, row) => {
    const key = String(row.config_key)
    const value = Number(row.config_value)
    if (!Number.isFinite(value)) return config
    if (key in config) return { ...config, [key]: value }
    return config
  }, DEFAULT_SUPPLEMENT_RECOMMENDATION_CONFIG)
}

async function persistRecommendation(supabase: SupabaseClient, userId: string, clientId: string, result: SupplementRecommendationResult, version = SUPPLEMENT_RECOMMENDATION_ENGINE_VERSION) {
  const recommendation = result.recommendation
  if (!recommendation) return

  const payload = {
    user_id: userId,
    client_id: clientId,
    supplement_id: recommendation.productId,
    status: 'active',
    recommendation_category: recommendation.category,
    recommended_at: recommendation.recommendedAt,
    last_qualified_at: recommendation.lastQualifiedAt,
    resolved_at: null,
    recommendation_reason_codes: recommendation.reasonCodes,
    algorithm_version: version,
  }

  await supabase
    .from('client_anastasis_supplement_recommendations')
    .upsert(payload, { onConflict: 'user_id,client_id,supplement_id' })
}

async function resolveStaleRecommendations(supabase: SupabaseClient, previousRecommendations: any[], result: SupplementRecommendationResult) {
  const shouldResolve = result.debug.resolved ||
    result.debug.reasonCodes.some((code) =>
      [
        'insufficient_logging_completeness',
        'nutritional_pattern_not_recurrent',
        'no_corresponding_functional_issue',
        'functional_trend_improving',
        'safety_suppressed',
      ].includes(code),
    )
  if (result.recommendation || !shouldResolve) return []
  const active = (previousRecommendations || []).filter((row) => row.status === 'active' && !row.resolved_at)
  if (!active.length) return []

  const ids = active.map((row) => row.id).filter(Boolean)
  if (ids.length) {
    await supabase
      .from('client_anastasis_supplement_recommendations')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        recommendation_reason_codes: result.debug.reasonCodes,
      })
      .in('id', ids)
  }

  return active.map((row) => ({
    productId: String(row.supplement_id),
    category: String(row.recommendation_category || 'general_nutrition'),
  }))
}

export async function getSupplementRecommendation({
  supabase,
  user,
  client,
  includeAdminDebug = false,
}: {
  supabase: SupabaseClient
  user: any
  client: any
  includeAdminDebug?: boolean
}) {
  const clientId = client.client_id
  // Never let a caller-supplied tier enable micronutrient engines or writes.
  // Ownership and tier are resolved again at the service boundary.
  const owned = await supabase.from('clients').select('*')
    .eq('client_id', clientId).eq('auth_user_id', user.id).maybeSingle()
  const empty = { recommendation: null, resolvedRecommendations: [], debug: null, nutritionScope: 'unavailable' as const }
  if (owned.error || !owned.data) return empty
  client = owned.data
  const micronutrients = canTrackMicronutrients(client.program)
  // Protein already participates in the same engine. Restrict its inputs,
  // rather than changing any eligibility, scoring or safety thresholds.
  const [directProteinIngredients, proteinNutrientLinks] = micronutrients ? [[], []] : await Promise.all([
    safeQuery<any[]>(supabase.from('supplement_ingredients').select('id,supplement_id,ingredient_key').eq('ingredient_key', 'protein'), []),
    // Protein may be supplied by a named ingredient such as whey. Preserve
    // that existing mapping while requesting no micronutrient catalog values.
    safeQuery<any[]>(supabase.from('ingredient_nutrients').select('supplement_ingredient_id,nutrients!inner(nutrient_key)').eq('nutrients.nutrient_key', 'protein'), []),
  ])
  const mappedProteinIngredients = proteinNutrientLinks.length ? await safeQuery<any[]>(
    supabase.from('supplement_ingredients').select('id,supplement_id,ingredient_key')
      .in('id', proteinNutrientLinks.map(row => row.supplement_ingredient_id)), [],
  ) : []
  const proteinIngredients = [...new Map([...directProteinIngredients, ...mappedProteinIngredients].map(row => [row.id, row])).values()]
  const proteinProductIds = Array.from(new Set(proteinIngredients.map(row => String(row.supplement_id))))
  if (!micronutrients && !proteinProductIds.length) return { ...empty, nutritionScope: 'protein' as const }
  const forProducts = (query: any) => micronutrients ? query : query.in('supplement_id', proteinProductIds)
  const startDate = daysAgo(13)
  const today = new Date().toISOString().slice(0, 10)

  const [
    config,
    nutritionLogs,
    recoveryLogs,
    cycleSymptoms,
    supplements,
    ingredients,
    ingredientNutrients,
    supportedFunctions,
    previousRecommendations,
    clinicalRecords,
  ] = await Promise.all([
    loadConfig(supabase),
    safeQuery<any[]>(supabase.from('nutrition_logs').select(micronutrients ? '*' : 'id,log_date,protein,completed').eq('client_id', clientId).gte('log_date', startDate).lte('log_date', today).order('log_date'), []),
    safeQuery<any[]>(supabase.from('recovery_logs').select('log_date,sleep_quality,energy_level,stress_level,soreness_level').eq('client_id', clientId).gte('log_date', startDate).lte('log_date', today).order('log_date'), []),
    safeQuery<any[]>(supabase.from('cycle_daily_symptoms').select('log_date,energy,training_readiness').eq('client_id', clientId).gte('log_date', startDate).lte('log_date', today).order('log_date'), []),
    safeQuery<any[]>(micronutrients
      ? supabase.from('supplements').select('id,supplement_key,product_name,status,product_url,recommendation_copy,disclaimer_copy,contraindication_metadata,minimum_matching_requirements')
      : supabase.from('supplements').select('id,supplement_key,product_name,status,product_url,contraindication_metadata,minimum_matching_requirements').in('id', proteinProductIds), []),
    micronutrients ? safeQuery<any[]>(supabase.from('supplement_ingredients').select('id,supplement_id,ingredient_key'), []) : Promise.resolve(proteinIngredients),
    micronutrients ? safeQuery<any[]>(supabase.from('ingredient_nutrients').select('supplement_ingredient_id,nutrients(nutrient_key)'), []) : Promise.resolve(proteinNutrientLinks),
    safeQuery<any[]>(forProducts(supabase.from('supplement_supported_functions').select('supplement_id,function_key')), []),
    safeQuery<any[]>(forProducts(supabase.from('client_anastasis_supplement_recommendations').select('id,supplement_id,recommendation_category,resolved_at,status,algorithm_version').eq('user_id', user.id).eq('client_id', clientId)), []),
    // Existing contraindication flags remain safety-only inputs for protein
    // products too. They never become EMBER coverage, advice or debug output.
    safeQuery<any[]>(supabase.from('client_nutrient_recommendations').select('safety_escalation_reason,nutrients(nutrient_key)').eq('user_id', user.id).eq('client_id', clientId).eq('status', 'active'), []),
  ])
  const nutritionLogIds = (nutritionLogs || []).map((log) => log.id).filter(Boolean)
  const [remainingRows, mealEntries, macroEntries] = nutritionLogIds.length
    ? await Promise.all([
        safeQuery<any[]>(supabase.from('nutrition_log_remaining').select(micronutrients ? '*' : 'nutrition_log_id,protein_remaining_g').in('nutrition_log_id', nutritionLogIds), []),
        safeQuery<any[]>(supabase.from('meal_entries').select('id,nutrition_log_id').in('nutrition_log_id', nutritionLogIds), []),
        safeQuery<any[]>(supabase.from('macro_entries').select('id,nutrition_log_id').in('nutrition_log_id', nutritionLogIds), []),
      ])
    : [[], [], []]

  const upperIntakeConcernNutrients = (clinicalRecords || [])
    .filter((row) => row.safety_escalation_reason === 'estimated_intake_above_established_ul')
    .map((row) => String(row.nutrients?.nutrient_key || ''))
    .filter(Boolean)

  const result = evaluateSupplementRecommendation({
    coverageDays: buildCoverageDays(nutritionLogs, remainingRows, mealEntries, macroEntries, micronutrients ? Object.keys(nutrientFields) : ['protein']),
    functionalInputs: buildFunctionalInputs(recoveryLogs, cycleSymptoms),
    formulations: buildFormulations({ supplements, ingredients, ingredientNutrients, supportedFunctions }),
    safetyContext: buildSafetyContext(client, previousRecommendations, upperIntakeConcernNutrients),
    config,
  })

  const proteinVersion = `${SUPPLEMENT_RECOMMENDATION_ENGINE_VERSION}:protein`
  // Older records do not identify their matched nutrients. A protein-capable
  // product may have qualified from micronutrients before a downgrade; retain
  // that history rather than overwriting or resolving its unknown basis.
  const scopedHistory = micronutrients ? previousRecommendations : previousRecommendations.filter(row => row.algorithm_version === proteinVersion)
  const legacyMatch = !micronutrients && result.recommendation && previousRecommendations.some(row =>
    String(row.supplement_id) === result.recommendation!.productId && row.algorithm_version !== proteinVersion,
  )
  if (!legacyMatch) await persistRecommendation(supabase, user.id, clientId, result, micronutrients ? SUPPLEMENT_RECOMMENDATION_ENGINE_VERSION : proteinVersion)
  const resolvedRecommendations = await resolveStaleRecommendations(supabase, scopedHistory, result)

  // Catalog copy can describe other nutrients in a mixed formulation. EMBER's
  // existing protein match uses the same explanation with protein-only wording.
  const recommendation = !micronutrients && result.recommendation ? {
    ...result.recommendation,
    recommendationCopy: `Your recently recorded protein totals have not consistently reached your usual protein target. Your related wellness trend has also been lower during this period. ${result.recommendation.productName} contains protein that can help supplement what you are getting through food.`,
    disclaimerCopy: 'This recommendation is based on your logged nutrition and wellness patterns and does not identify or diagnose a deficiency.',
    why: {
      ...result.recommendation.why,
      nutrition: 'Your recorded protein totals have not consistently reached your usual protein target.',
      disclaimer: 'This recommendation is based on your logged nutrition and wellness patterns and does not identify or diagnose a deficiency.',
    },
  } : result.recommendation
  return {
    recommendation,
    resolvedRecommendations,
    debug: includeAdminDebug && isAOSAdmin(user.email, user.app_metadata) ? result.debug : null,
    nutritionScope: micronutrients ? 'micronutrients' as const : 'protein' as const,
  }
}
