import {
  evaluateNutrientInsight,
  type NutrientInsight,
  type NutrientInteraction,
  type NutrientReferenceValue,
  type NutrientRelationship,
} from '@/lib/nutrition/nutrientIntelligence'

const nutrientFields: Record<string, { remaining: string; target: string; unit: string }> = {
  iron: { remaining: 'iron_remaining_mg', target: 'iron_target_mg', unit: 'mg' },
  magnesium: { remaining: 'magnesium_remaining_mg', target: 'magnesium_target_mg', unit: 'mg' },
  zinc: { remaining: 'zinc_remaining_mg', target: 'zinc_target_mg', unit: 'mg' },
  calcium: { remaining: 'calcium_remaining_mg', target: 'calcium_target_mg', unit: 'mg' },
  vitamin_c: { remaining: 'vitamin_c_remaining_mg', target: 'vitamin_c_target_mg', unit: 'mg' },
  vitamin_d: { remaining: 'vitamin_d_remaining_mcg', target: 'vitamin_d_target_mcg', unit: 'mcg' },
  b12: { remaining: 'b12_remaining_mcg', target: 'b12_target_mcg', unit: 'mcg' },
  b9: { remaining: 'b9_remaining_mcg', target: 'b9_target_mcg', unit: 'mcg' },
}

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

function numeric(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function consumedFromRemaining(log: Record<string, unknown> | null, remaining: Record<string, unknown> | null, nutrientKey: string) {
  const fields = nutrientFields[nutrientKey]
  if (!fields || !log || !remaining) return { amount: null, target: null, unit: fields?.unit || null }

  const target = numeric(log[fields.target])
  const left = numeric(remaining[fields.remaining])
  if (target === null || left === null) return { amount: null, target, unit: fields.unit }

  return {
    amount: Math.max(0, target - left),
    target,
    unit: fields.unit,
  }
}

function symptomKey(row: any) {
  return String(row?.symptom_types?.name || row?.symptom_key || '').toLowerCase().trim()
}

async function safeQuery<T>(query: PromiseLike<{ data: T | null; error: any }>, fallback: T): Promise<T> {
  const { data, error } = await query
  if (error) return fallback
  return data ?? fallback
}

export async function getNutrientInsights({
  supabase,
  userId,
  clientId,
  limit = 3,
}: {
  supabase: any
  userId: string
  clientId: string
  limit?: number
}): Promise<NutrientInsight[]> {
  const today = new Date().toISOString().slice(0, 10)
  const fourteenDaysAgo = daysAgo(14)

  const [nutrients, latestNutritionLog, latestRemaining, symptoms, cycleBurden, cycleSymptoms, referenceValues, relationships, interactions, clinicalRecords, supplementLogs] =
    await Promise.all([
      safeQuery<any[]>(
        supabase
          .from('nutrients')
          .select('id,nutrient_key,canonical_name,default_unit')
          .in('nutrient_key', Object.keys(nutrientFields))
          .limit(20),
        [],
      ),
      safeQuery<any>(
        supabase
          .from('nutrition_logs')
          .select('*')
          .eq('client_id', clientId)
          .order('log_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        null,
      ),
      safeQuery<any>(
        supabase
          .from('nutrition_log_remaining')
          .select('*')
          .eq('client_id', clientId)
          .order('log_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        null,
      ),
      safeQuery<any[]>(
        supabase
          .from('client_symptom_logs')
          .select('severity,created_at,symptom_types(name,category)')
          .eq('client_id', clientId)
          .gte('created_at', `${fourteenDaysAgo}T00:00:00.000Z`)
          .order('created_at', { ascending: false })
          .limit(50),
        [],
      ),
      safeQuery<any>(
        supabase
          .from('cycle_burden_scores')
          .select('burden_band,burden_score,normalized_factors,log_date')
          .eq('client_id', clientId)
          .order('log_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        null,
      ),
      safeQuery<any[]>(
        supabase
          .from('cycle_daily_symptoms')
          .select('energy,training_readiness,log_date')
          .eq('client_id', clientId)
          .gte('log_date', fourteenDaysAgo)
          .order('log_date', { ascending: false })
          .limit(14),
        [],
      ),
      safeQuery<any[]>(
        supabase
          .from('nutrient_reference_values')
          .select('reference_type,amount,unit,applies_to_intake_source,min_age_years,max_age_years,sex,pregnancy_status,nutrient_form,nutrients(nutrient_key),nutrient_reference_sources(source_key)')
          .limit(200),
        [],
      ),
      safeQuery<any[]>(
        supabase
          .from('nutrient_symptom_relationships')
          .select('relationship_type,evidence_strength,notes,symptom_key,nutrients(nutrient_key),nutrient_reference_sources(source_key),symptom_types(name)')
          .limit(200),
        [],
      ),
      safeQuery<any[]>(
        supabase
          .from('nutrient_interactions')
          .select('interaction_type,evidence_strength,notes,nutrients!nutrient_interactions_nutrient_id_fkey(nutrient_key),related:nutrients!nutrient_interactions_related_nutrient_id_fkey(nutrient_key),nutrient_reference_sources(source_key)')
          .limit(200),
        [],
      ),
      safeQuery<any[]>(
        supabase
          .from('client_nutrient_clinical_records')
          .select('clinical_state,nutrient_id,nutrients(nutrient_key)')
          .eq('user_id', userId)
          .eq('client_id', clientId)
          .order('record_date', { ascending: false })
          .limit(20),
        [],
      ),
      safeQuery<any[]>(
        supabase
          .from('client_supplement_intake_logs')
          .select('servings_consumed,client_supplement_product_nutrients(amount_per_serving,unit,nutrients(nutrient_key))')
          .eq('user_id', userId)
          .eq('client_id', clientId)
          .gte('log_date', fourteenDaysAgo)
          .lte('log_date', today)
          .limit(100),
        [],
      ),
    ])

  const symptomKeys = Array.from(new Set((symptoms || []).map(symptomKey).filter(Boolean)))
  const symptomDays = new Set((symptoms || []).map((row) => String(row.created_at || '').slice(0, 10)).filter(Boolean)).size
  const symptomSeverityMax = Math.max(0, ...(symptoms || []).map((row) => Number(row.severity || 0)))
  const energyValues = (cycleSymptoms || []).map((row) => row.energy)
  const readinessValues = (cycleSymptoms || []).map((row) => row.training_readiness)

  const mappedReferenceValues: NutrientReferenceValue[] = (referenceValues || []).map((row) => ({
    nutrientKey: row.nutrients?.nutrient_key,
    referenceType: row.reference_type,
    amount: Number(row.amount),
    unit: row.unit,
    appliesToIntakeSource: row.applies_to_intake_source,
    minAgeYears: row.min_age_years,
    maxAgeYears: row.max_age_years,
    sex: row.sex,
    pregnancyStatus: row.pregnancy_status,
    nutrientForm: row.nutrient_form,
    sourceKey: row.nutrient_reference_sources?.source_key || 'unknown',
  })).filter((row) => row.nutrientKey && Number.isFinite(row.amount))

  const mappedRelationships: NutrientRelationship[] = (relationships || []).map((row) => ({
    nutrientKey: row.nutrients?.nutrient_key,
    symptomKey: row.symptom_key || row.symptom_types?.name || '',
    relationshipType: row.relationship_type,
    evidenceStrength: row.evidence_strength,
    sourceKey: row.nutrient_reference_sources?.source_key || 'unknown',
    notes: row.notes,
  })).filter((row) => row.nutrientKey && row.symptomKey)

  const mappedInteractions: NutrientInteraction[] = (interactions || []).map((row) => ({
    nutrientKey: row.nutrients?.nutrient_key,
    relatedNutrientKey: row.related?.nutrient_key,
    interactionType: row.interaction_type,
    evidenceStrength: row.evidence_strength,
    sourceKey: row.nutrient_reference_sources?.source_key || 'unknown',
    notes: row.notes,
  })).filter((row) => row.nutrientKey && row.relatedNutrientKey)

  const supplementAmountByNutrient = new Map<string, number>()
  for (const log of supplementLogs || []) {
    const servings = Number(log.servings_consumed || 0)
    const nutrientsForProduct = Array.isArray(log.client_supplement_product_nutrients)
      ? log.client_supplement_product_nutrients
      : []
    for (const nutrient of nutrientsForProduct) {
      const key = nutrient.nutrients?.nutrient_key
      if (!key) continue
      const amount = Number(nutrient.amount_per_serving || 0) * servings
      supplementAmountByNutrient.set(key, (supplementAmountByNutrient.get(key) || 0) + amount)
    }
  }

  const clinicalByNutrient = new Map<string, 'confirmed_deficiency' | 'confirmed_toxicity'>()
  for (const record of clinicalRecords || []) {
    const key = record.nutrients?.nutrient_key
    if (key && !clinicalByNutrient.has(key)) clinicalByNutrient.set(key, record.clinical_state)
  }

  const insights = (nutrients || []).map((nutrient) => {
    const consumed = consumedFromRemaining(latestNutritionLog, latestRemaining, nutrient.nutrient_key)
    const supplementAmount = supplementAmountByNutrient.get(nutrient.nutrient_key) || 0
    const foodAmount = consumed.amount
    const totalAmount = foodAmount === null ? supplementAmount || null : foodAmount + supplementAmount

    return evaluateNutrientInsight({
      nutrientKey: nutrient.nutrient_key,
      nutrientName: nutrient.canonical_name,
      foodAmount,
      supplementAmount,
      totalAmount,
      targetAmount: consumed.target,
      unit: consumed.unit || nutrient.default_unit,
      symptomKeys,
      symptomDays,
      symptomSeverityMax,
      energyValues,
      readinessValues,
      menstrualBurdenBand: cycleBurden?.burden_band || null,
      menstrualBurdenChangedFromBaseline: false,
      confirmedClinicalState: clinicalByNutrient.get(nutrient.nutrient_key) || null,
      referenceValues: mappedReferenceValues,
      symptomRelationships: mappedRelationships,
      interactions: mappedInteractions,
    })
  })

  const rank: Record<string, number> = {
    safety_warning_clinician_recommendation: 6,
    discuss_labs_with_clinician: 5,
    review_supplement_intake: 4,
    food_first_recommendation: 3,
    monitor_pattern: 2,
    no_action: 1,
  }

  return insights
    .sort((a, b) => rank[b.action] - rank[a.action])
    .slice(0, limit)
}
