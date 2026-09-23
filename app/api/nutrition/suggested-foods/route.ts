import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import {
  buildSuggestedFoods,
  hasMeaningfulNutritionGaps,
  type NutritionRemainingSnapshot,
  type SuggestedFoodCandidate,
} from '@/lib/nutrition/suggestedFoods'
import { flattenFoodsNutrition, foodWithNutritionSelect } from '@/lib/nutrition/foodModel'
import { buildPhysiologyRecommendationEffects } from '@/lib/physiology/recommendationEffects'

type MealRow = {
  food_id?: string | null
}

function avoidTermsFromClient(client: Record<string, unknown> | null) {
  if (!client) return []
  return [client.allergies, client.intolerances, client.dietary_restrictions]
    .flatMap((value) => {
      if (Array.isArray(value)) return value
      if (typeof value === 'string') return value.split(/[,;]/)
      return []
    })
    .map((value) => String(value).trim())
    .filter(Boolean)
}

export async function GET(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const nutritionLogId = searchParams.get('nutritionLogId')

  if (!nutritionLogId) {
    return NextResponse.json({ error: 'Missing nutrition log.' }, { status: 400 })
  }

  const { data: log, error: logError } = await supabase
    .from('nutrition_logs')
    .select('id, auth_user_id, client_id')
    .eq('id', nutritionLogId)
    .single()

  if (logError || !log) {
    return NextResponse.json(
      { error: logError?.message || 'Nutrition log not found.' },
      { status: 404 },
    )
  }

  if (log.auth_user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('client_id', log.client_id)
    .eq('auth_user_id', user.id)
    .maybeSingle()

  const { data: remaining, error: remainingError } = await supabase
    .from('nutrition_log_remaining')
    .select('*')
    .eq('nutrition_log_id', nutritionLogId)
    .maybeSingle()

  if (remainingError) {
    console.error('NUTRITION SUGGESTED REMAINING ERROR:', remainingError)
    return NextResponse.json({ error: 'Suggested foods could not be loaded. Please try again.' }, { status: 500 })
  }

  const { data: meals, error: mealError } = await supabase
    .from('meal_entries')
    .select('food_id')
    .eq('nutrition_log_id', nutritionLogId)

  if (mealError) {
    console.error('NUTRITION SUGGESTED MEALS ERROR:', mealError)
    return NextResponse.json({ error: 'Suggested foods could not be loaded. Please try again.' }, { status: 500 })
  }

  const loggedFoodIds = (meals || [])
    .map((meal: MealRow) => meal.food_id)
    .filter((id): id is string => Boolean(id))

  if (!loggedFoodIds.length) {
    return NextResponse.json({
      state: 'needs_logs',
      suggestions: [],
      remaining,
    })
  }

  if (!hasMeaningfulNutritionGaps(remaining as NutritionRemainingSnapshot | null)) {
    return NextResponse.json({
      state: 'complete',
      suggestions: [],
      remaining,
    })
  }

  const { data: foods, error: foodsError } = await supabase
    .from('foods')
    .select(
      `
        ${foodWithNutritionSelect},
        food_serving_options (
          label,
          grams,
          is_default,
          sort_order
        )
      `,
    )
    .limit(250)

  if (foodsError) {
    console.error('NUTRITION SUGGESTED FOODS ERROR:', foodsError)
    return NextResponse.json({ error: 'Suggested foods could not be loaded. Please try again.' }, { status: 500 })
  }

  const [{ data: latestBurden }, { data: latestTrend }, { data: latestPatterns }] = await Promise.all([
    supabase
      .from('cycle_burden_scores')
      .select('burden_score, burden_band, normalized_factors, algorithm_version')
      .eq('user_id', user.id)
      .eq('client_id', log.client_id)
      .order('log_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('cycle_burden_trends')
      .select('energy_falls_on_high_flow_days, readiness_falls_on_high_flow_days')
      .eq('user_id', user.id)
      .eq('client_id', log.client_id)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('physiology_pattern_flags')
      .select('pattern_key, confidence, contributing_domains, algorithm_version, recommendation_effects, suppressed_reason')
      .eq('user_id', user.id)
      .eq('client_id', log.client_id)
      .is('suppressed_reason', null)
      .order('date_last_evaluated', { ascending: false })
      .limit(5),
  ])

  const physiologyEffects = buildPhysiologyRecommendationEffects({
    flowBurden: latestBurden
      ? {
          burdenScore: Number(latestBurden.burden_score || 0),
          burdenBand: latestBurden.burden_band,
          factors: Array.isArray(latestBurden.normalized_factors?.factors)
            ? latestBurden.normalized_factors.factors
            : [],
          algorithmVersion: latestBurden.algorithm_version,
        }
      : null,
    flowEnergyPattern: Boolean(latestTrend?.energy_falls_on_high_flow_days),
    activePatterns: (latestPatterns || []).map((pattern: any) => ({
      pattern: pattern.pattern_key,
      confidence: Number(pattern.confidence || 0),
      contributingDomains: pattern.contributing_domains || [],
      algorithmVersion: pattern.algorithm_version,
      recommendationEffects: pattern.recommendation_effects || [],
    })),
  })

  const suggestions = buildSuggestedFoods({
    remaining: remaining as NutritionRemainingSnapshot | null,
    candidates: flattenFoodsNutrition(foods) as SuggestedFoodCandidate[],
    loggedFoodIds,
    avoidTerms: avoidTermsFromClient(client),
    recommendationEffects: physiologyEffects.effects,
  })

  if (physiologyEffects.effects.length) {
    await supabase.from('pattern_recommendation_events').insert({
      user_id: user.id,
      client_id: log.client_id,
      recommendation_date: new Date().toISOString().split('T')[0],
      recommendation_area: 'nutrition',
      affected_item: 'suggested_foods',
      recommendation: {
        state: suggestions.length ? 'ready' : 'complete',
        suggestions: suggestions.map((suggestion) => ({
          foodId: suggestion.foodId,
          name: suggestion.name,
          reason: suggestion.reason,
          contribution: suggestion.contribution,
          score: suggestion.score,
        })),
      },
      pattern_keys: physiologyEffects.audit.patternKeys,
      evidence_domains: physiologyEffects.audit.evidenceDomains,
      rule_version: physiologyEffects.ruleVersion,
      formulation_rule_id: physiologyEffects.ruleVersion,
      algorithm_version: physiologyEffects.ruleVersion,
      confidence_at_recommendation: physiologyEffects.audit.confidenceAtRecommendation,
      recommendation_effects: physiologyEffects.effects,
      user_response: {},
    })
  }

  return NextResponse.json({
    state: suggestions.length ? 'ready' : 'complete',
    suggestions,
    remaining,
    physiologySupportActive: physiologyEffects.effects.length > 0,
  })
}
