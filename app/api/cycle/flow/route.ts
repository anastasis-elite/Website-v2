import { NextResponse } from 'next/server'

import {
  analyzeCycleBurdenTrends,
  calculateDailyMenstrualFlowBurden,
  type MenstrualProductLogInput,
} from '@/lib/cycle/menstrualFlow'
import { getCycleStatus } from '@/lib/cycle/getCycleStatus'
import { evaluateMenstrualFlowEscalation } from '@/lib/physiology/escalation'
import {
  buildClinicianPatternObservation,
  evaluatePhysiologyPatterns,
  type PatternEvidenceInput,
} from '@/lib/physiology/patternEngine'
import { createClient } from '@/lib/supabase/server'
import { getClientLocalDate } from '@/lib/timezone'

const allowedSeverities = new Set(['none', 'mild', 'moderate', 'severe'])

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function ratingOrNull(value: unknown) {
  const parsed = numberOrNull(value)
  if (parsed === null) return null
  return Math.max(1, Math.min(10, Math.round(parsed)))
}

function cleanSeverityMap(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([, entry]) => {
      return allowedSeverities.has(String(entry))
    }),
  )
}

function cleanProducts(value: unknown): MenstrualProductLogInput[] {
  if (!Array.isArray(value)) return []

  return value.reduce<MenstrualProductLogInput[]>((products, item) => {
      if (!item || typeof item !== 'object') return products
      const product = item as Record<string, unknown>
      const productType = String(product.productType || product.product_type || '')

      if (!['tampon', 'pad', 'cup', 'disc', 'period_underwear', 'other'].includes(productType)) {
        return products
      }

      products.push({
        productType: productType as MenstrualProductLogInput['productType'],
        absorbency: product.absorbency ? String(product.absorbency) as MenstrualProductLogInput['absorbency'] : null,
        quantity: numberOrNull(product.quantity),
        saturation: product.saturation ? String(product.saturation) as MenstrualProductLogInput['saturation'] : null,
        estimatedMl: numberOrNull(product.estimatedMl ?? product.estimated_ml),
        empties: numberOrNull(product.empties),
        capacityMl: numberOrNull(product.capacityMl ?? product.capacity_ml),
        fullness: product.fullness ? String(product.fullness) as MenstrualProductLogInput['fullness'] : null,
        changeIntervalHours: numberOrNull(product.changeIntervalHours ?? product.change_interval_hours),
        leakOrOverflow: Boolean(product.leakOrOverflow ?? product.leak_or_overflow),
        customLabel: product.customLabel ? String(product.customLabel).slice(0, 80) : null,
      })

      return products
    }, [])
}

function cycleIndexForDate(periodStarts: string[], logDate: string) {
  const index = periodStarts.filter((date) => date <= logDate).length
  return index || null
}

function buildPatternEvidenceFromTrend({
  trend,
  burden,
  date,
}: {
  trend: ReturnType<typeof analyzeCycleBurdenTrends>
  burden: ReturnType<typeof calculateDailyMenstrualFlowBurden>
  date: string
}): PatternEvidenceInput[] {
  const evidence: PatternEvidenceInput[] = []

  if (trend.energyFallsOnHighFlowDays && trend.cyclesAnalyzed >= 2) {
    evidence.push({
      pattern: 'stress_recovery_associated',
      domain: 'menstrual_reproductive',
      direction: 'supporting',
      strength: 'moderate',
      observation: 'High menstrual flow burden repeatedly coincides with lower energy.',
      observedAt: `${date}T12:00:00.000Z`,
    })
    evidence.push({
      pattern: 'stress_recovery_associated',
      domain: 'recovery',
      direction: 'supporting',
      strength: 'moderate',
      observation: 'Recovery context repeatedly falls during the high-flow window.',
      observedAt: `${date}T12:00:00.000Z`,
    })
  }

  if (burden.burdenBand === 'high' || burden.burdenBand === 'very_high') {
    evidence.push({
      pattern: 'stress_recovery_associated',
      domain: 'menstrual_reproductive',
      direction: 'supporting',
      strength: burden.burdenBand === 'very_high' ? 'moderate' : 'low',
      observation: 'Today has elevated menstrual flow burden.',
      observedAt: `${date}T12:00:00.000Z`,
    })
  }

  return evidence
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const clientId = String(body.clientId || body.client_id || '')

    if (!clientId) {
      return NextResponse.json({ error: 'Missing client.' }, { status: 400 })
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('client_id', clientId)
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (clientError) {
      return NextResponse.json({ error: clientError.message }, { status: 500 })
    }

    if (!client) {
      return NextResponse.json({ error: 'Client not found for this user.' }, { status: 404 })
    }

    const logDate = typeof body.logDate === 'string' ? body.logDate : getClientLocalDate(client)
    const products = cleanProducts(body.products)
    const symptoms = cleanSeverityMap(body.symptoms)
    const energy = ratingOrNull(body.energy)
    const fatigue = ratingOrNull(body.fatigue)
    const perceivedRecovery = ratingOrNull(body.perceivedRecovery ?? body.perceived_recovery)
    const trainingReadiness = ratingOrNull(body.trainingReadiness ?? body.training_readiness)
    const cycleStatus = getCycleStatus(client)
    const burden = calculateDailyMenstrualFlowBurden({ products })

    const { data: existingCycleLog } = await supabase
      .from('cycle_logs')
      .select('symptoms')
      .eq('client_id', clientId)
      .eq('auth_user_id', user.id)
      .eq('log_date', logDate)
      .maybeSingle()

    const existingSymptoms =
      existingCycleLog?.symptoms &&
      typeof existingCycleLog.symptoms === 'object' &&
      !Array.isArray(existingCycleLog.symptoms)
        ? existingCycleLog.symptoms
        : {}

    const { data: cycleLog, error: cycleLogError } = await supabase
      .from('cycle_logs')
      .upsert(
        {
          client_id: clientId,
          auth_user_id: user.id,
          log_date: logDate,
          cycle_day: cycleStatus.cycleDay,
          cycle_phase: cycleStatus.phase,
          bleeding: true,
          symptoms: {
            ...existingSymptoms,
            ...symptoms,
          },
          flow_burden_score: burden.burdenScore,
          flow_burden_band: burden.burdenBand,
          flow_burden_algorithm_version: burden.algorithmVersion,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'client_id,log_date' },
      )
      .select('*')
      .single()

    if (cycleLogError) {
      return NextResponse.json({ error: cycleLogError.message }, { status: 500 })
    }

    const { data: flowLog, error: flowLogError } = await supabase
      .from('menstrual_flow_logs')
      .insert({
        user_id: user.id,
        client_id: clientId,
        log_date: logDate,
        cycle_log_id: cycleLog?.id || null,
        cycle_day: cycleStatus.cycleDay,
        cycle_phase: cycleStatus.phase,
        source: 'member_entry',
        provenance_category: 'self_reported',
        raw_entry: {
          products,
          symptoms,
          energy,
          fatigue,
          perceivedRecovery,
          trainingReadiness,
        },
        notes: typeof body.notes === 'string' ? body.notes.slice(0, 1000) : null,
      })
      .select('*')
      .single()

    if (flowLogError) {
      return NextResponse.json({ error: flowLogError.message }, { status: 500 })
    }

    if (products.length) {
      const { error: productError } = await supabase.from('menstrual_product_logs').insert(
        products.map((product) => ({
          flow_log_id: flowLog.id,
          user_id: user.id,
          client_id: clientId,
          log_date: logDate,
          product_type: product.productType,
          absorbency: product.absorbency || null,
          quantity: product.quantity || 1,
          saturation: product.saturation || null,
          estimated_ml: product.estimatedMl || null,
          empties: product.empties || null,
          capacity_ml: product.capacityMl || null,
          fullness: product.fullness || null,
          change_interval_hours: product.changeIntervalHours || null,
          leak_or_overflow: Boolean(product.leakOrOverflow),
          custom_label: product.customLabel || null,
          provenance_category: 'measured',
          raw_entry: product,
        })),
      )

      if (productError) {
        return NextResponse.json({ error: productError.message }, { status: 500 })
      }
    }

    const { error: symptomError } = await supabase
      .from('cycle_daily_symptoms')
      .upsert(
        {
          user_id: user.id,
          client_id: clientId,
          log_date: logDate,
          cycle_log_id: cycleLog?.id || null,
          cycle_day: cycleStatus.cycleDay,
          cycle_phase: cycleStatus.phase,
          energy,
          fatigue,
          perceived_recovery: perceivedRecovery,
          training_readiness: trainingReadiness,
          symptom_severity: symptoms,
          numeric_scales: { energy, fatigue, perceivedRecovery, trainingReadiness },
          provenance_category: 'self_reported',
          raw_entry: body,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,client_id,log_date' },
      )

    if (symptomError) {
      return NextResponse.json({ error: symptomError.message }, { status: 500 })
    }

    const { data: burdenScore, error: burdenError } = await supabase
      .from('cycle_burden_scores')
      .upsert({
        user_id: user.id,
        client_id: clientId,
        flow_log_id: flowLog.id,
        log_date: logDate,
        cycle_day: cycleStatus.cycleDay,
        cycle_phase: cycleStatus.phase,
        algorithm_version: burden.algorithmVersion,
        burden_score: burden.burdenScore,
        burden_band: burden.burdenBand,
        normalized_factors: {
          productCount: burden.productCount,
          overflowEvents: burden.overflowEvents,
          fullySaturatedHighAbsorbencyCount: burden.fullySaturatedHighAbsorbencyCount,
          frequentChangeEvents: burden.frequentChangeEvents,
          recordedFluidMl: burden.recordedFluidMl,
          factors: burden.factors,
        },
        raw_data_refs: {
          menstrualFlowLogId: flowLog.id,
          cycleDailySymptomDate: logDate,
        },
        provenance_category: 'calculated',
      }, { onConflict: 'user_id,client_id,log_date' })
      .select('*')
      .single()

    if (burdenError) {
      return NextResponse.json({ error: burdenError.message }, { status: 500 })
    }

    const [{ data: periodStarts }, { data: burdenRows }, { data: symptomRows }] = await Promise.all([
      supabase
        .from('cycle_logs')
        .select('log_date')
        .eq('client_id', clientId)
        .eq('auth_user_id', user.id)
        .eq('period_started', true)
        .order('log_date', { ascending: true }),
      supabase
        .from('cycle_burden_scores')
        .select('log_date, cycle_day, burden_score, burden_band')
        .eq('user_id', user.id)
        .eq('client_id', clientId)
        .order('log_date', { ascending: true })
        .limit(180),
      supabase
        .from('cycle_daily_symptoms')
        .select('log_date, energy, training_readiness, symptom_severity')
        .eq('user_id', user.id)
        .eq('client_id', clientId)
        .order('log_date', { ascending: true })
        .limit(180),
    ])

    const periodStartDates = (periodStarts || []).map((row: { log_date: string }) => String(row.log_date)).sort()
    const symptomsByDate = new Map((symptomRows || []).map((row: any) => [String(row.log_date), row]))
    const trendRows = (burdenRows || []).map((row: any) => {
      const symptomRow = symptomsByDate.get(String(row.log_date))
      return {
        cycleIndex: cycleIndexForDate(periodStartDates, String(row.log_date)),
        cycleDay: row.cycle_day,
        burdenScore: row.burden_score,
        burdenBand: row.burden_band,
        energy: symptomRow?.energy,
        trainingReadiness: symptomRow?.training_readiness,
        symptoms: symptomRow?.symptom_severity,
      }
    })
    const trend = analyzeCycleBurdenTrends(trendRows)

    const { error: trendError } = await supabase.from('cycle_burden_trends').insert({
      user_id: user.id,
      client_id: clientId,
      algorithm_version: trend.algorithmVersion,
      cycles_analyzed: trend.cyclesAnalyzed,
      typical_highest_flow_days: trend.typicalHighestFlowDays,
      heavy_flow_window_days: trend.heavyFlowWindowDays,
      energy_falls_on_high_flow_days: trend.energyFallsOnHighFlowDays,
      readiness_falls_on_high_flow_days: trend.readinessFallsOnHighFlowDays,
      headache_window_days: trend.headacheWindowDays,
      baseline_score: trend.baselineScore,
      latest_cycle_deviation: trend.latestCycleDeviation,
      anticipatory_window: trend.anticipatoryWindow,
      observations: trend.observations,
      provenance_category: 'calculated',
    })

    if (trendError) {
      return NextResponse.json({ error: trendError.message }, { status: 500 })
    }

    const escalation = evaluateMenstrualFlowEscalation({
      date: logDate,
      burden,
      symptoms: { ...symptoms, energy, fatigue },
      baselineDeviation: trend.latestCycleDeviation,
    })

    if (escalation.status !== 'none') {
      const { error: followUpError } = await supabase.from('clinical_follow_up_events').insert({
        user_id: user.id,
        client_id: clientId,
        event_date: logDate,
        event_type: 'menstrual_flow',
        status: escalation.status,
        reasons: escalation.reasons,
        user_message: escalation.message,
        algorithm_version: escalation.algorithmVersion,
        source_table: 'cycle_burden_scores',
        source_record_id: burdenScore.id,
        provenance_category: 'algorithmic_wellness_observation',
        appointment_request_offered: false,
        clinician_contact_authorized: false,
        health_summary_share_authorized: false,
      })

      if (followUpError) {
        return NextResponse.json({ error: followUpError.message }, { status: 500 })
      }
    }

    const patternEvidence = buildPatternEvidenceFromTrend({ trend, burden, date: logDate })
    const flags = evaluatePhysiologyPatterns({ evidence: patternEvidence })

    for (const flag of flags.filter((item) => item.confidence > 0 || item.suppressedReason)) {
      const { data: savedFlag, error: flagError } = await supabase
        .from('physiology_pattern_flags')
        .insert({
          user_id: user.id,
          client_id: clientId,
          pattern_key: flag.pattern,
          classification: flag.classification,
          confidence: flag.confidence,
          contributing_domains: flag.contributingDomains,
          supporting_observations: flag.supportingEvidence,
          conflicting_observations: flag.conflictingEvidence,
          longitudinal_consistency: flag.longitudinalConsistency,
          date_first_observed: flag.dateFirstObserved,
          date_last_evaluated: flag.dateLastEvaluated,
          recommendation_effects: flag.recommendationEffects,
          clinical_escalation_status: flag.clinicalEscalationStatus,
          algorithm_version: flag.algorithmVersion,
          suppressed_reason: flag.suppressedReason || null,
          provenance_category: 'algorithmic_wellness_observation',
        })
        .select('*')
        .single()

      if (flagError) {
        return NextResponse.json({ error: flagError.message }, { status: 500 })
      }

      if (savedFlag) {
        const evidenceRows = [...flag.supportingEvidence, ...flag.conflictingEvidence].map((item) => ({
          pattern_flag_id: savedFlag.id,
          user_id: user.id,
          client_id: clientId,
          pattern_key: flag.pattern,
          evidence_category:
            item.domain === 'clinician_lab'
              ? 'clinician_provided'
              : item.domain === 'menstrual_reproductive' || item.domain === 'recovery' || item.domain === 'symptoms'
                ? 'self_reported'
                : 'calculated',
          domain: item.domain,
          direction: item.direction,
          strength: item.strength,
          observation: item.observation,
          source_table: 'cycle_burden_scores',
          source_record_id: burdenScore.id,
          algorithm_version: flag.algorithmVersion,
          observed_at: item.observedAt || new Date().toISOString(),
        }))

        if (evidenceRows.length) {
          const { error: evidenceError } = await supabase.from('physiology_pattern_evidence').insert(evidenceRows)

          if (evidenceError) {
            return NextResponse.json({ error: evidenceError.message }, { status: 500 })
          }
        }

        if (flag.confidence > 0) {
          const observation = buildClinicianPatternObservation(flag)
          const { error: observationError } = await supabase.from('clinical_observation_records').insert({
            user_id: user.id,
            client_id: clientId,
            observation_date: logDate,
            title: observation.title,
            classification: observation.classification,
            measured_data: observation.measuredData,
            self_reported_data: observation.selfReportedData,
            calculated_data: observation.calculatedData,
            algorithmic_wellness_observation: observation.algorithmicWellnessObservation,
            clinician_provided_data: observation.clinicianProvidedData,
            clinical_interpretation: observation.clinicalInterpretation,
            algorithm_version: flag.algorithmVersion,
            source_pattern_flag_id: savedFlag.id,
          })

          if (observationError) {
            return NextResponse.json({ error: observationError.message }, { status: 500 })
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      burden,
      trend,
      escalation,
      patterns: flags.map((flag) => ({
        pattern: flag.pattern,
        confidence: flag.confidence,
        suppressedReason: flag.suppressedReason,
        classification: flag.classification,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Menstrual flow log could not be saved.',
      },
      { status: 500 },
    )
  }
}
