import { loadProgramLogicInputs } from './loadProgramLogicInputs'

import {
  numeric,
  nullableNumeric,
  runCapacityEngine,
  runCycleEngine,
  runFlameExecutionEngine,
  runFuelReadinessEngine,
  runHydrationEngine,
  runNutritionEngine,
  runPostureCompensationEngine,
  runRecoveryEngine,
  runSymptomEngine,
  runWorkoutDecisionEngine,
} from './engines'

import type {
  DashboardTrend,
  ProgramLogicOutput,
  ProgramTier,
} from './types'

import { evaluateCapacityHistory } from '@/lib/workout-os/evaluateCapacityHistory'
import { buildRecoveryActions } from '@/lib/workout-os/buildRecoveryActions'

export const DASHBOARD_ENGINE_VERSION =
  'aos_daily_logic_v1.0.0'

function day(offset: number) {
  const date = new Date()

  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() + offset)

  return date.toISOString().slice(0, 10)
}

function average(
  values: Array<number | null>,
) {
  const present = values.filter(
    (value): value is number =>
      value !== null,
  )

  return present.length
    ? present.reduce(
        (sum, value) => sum + value,
        0,
      ) / present.length
    : null
}

function change(
  current: number | null,
  previous: number | null,
) {
  if (
    current === null ||
    previous === null ||
    previous === 0
  ) {
    return null
  }

  return Math.round(
    ((current - previous) / previous) *
      100,
  )
}

function age(birthdate: unknown) {
  if (!birthdate) return null

  const born = new Date(
    String(birthdate),
  )

  if (Number.isNaN(born.getTime())) {
    return null
  }

  return Math.floor(
    (Date.now() - born.getTime()) /
      31557600000,
  )
}

function buildTrends(
  inputs: Awaited<
    ReturnType<
      typeof loadProgramLogicInputs
    >
  >,
): DashboardTrend[] {
  const currentDates = Array.from(
    { length: 7 },
    (_, index) => day(index - 6),
  )

  const previousDates = Array.from(
    { length: 7 },
    (_, index) => day(index - 13),
  )

  const totals =
    inputs.nutritionTotals.reduce(
      (
        map: Record<
          string,
          {
            calories: number
            protein: number
          }
        >,
        row: any,
      ) => {
        const value =
          map[row.nutrition_log_id] || {
            calories: 0,
            protein: 0,
          }

        value.calories += numeric(
          row.calories_eaten,
        )

        value.protein += numeric(
          row.protein_eaten_g,
        )

        map[row.nutrition_log_id] =
          value

        return map
      },
      {},
    )

  const nutrition = new Map(
    inputs.nutritionLogs.map(
      (row: any) => [
        row.log_date,
        {
          calories:
            totals[row.id]?.calories ??
            null,

          protein:
            totals[row.id]?.protein ??
            null,

          water: nullableNumeric(
            row.water_consumed_oz,
          ),
        },
      ],
    ),
  )

  const workouts = new Set(
    inputs.workoutHistory
      .filter(
        (row: any) => row.completed,
      )
      .map((row: any) =>
        String(row.workout_date).slice(
          0,
          10,
        ),
      ),
  )

  const make = (
    key: DashboardTrend['key'],
    label: string,
    unit: string,
    getter: (
      date: string,
    ) => number | null,
  ): DashboardTrend => {
    const values =
      currentDates.map(getter)

    const previous =
      previousDates.map(getter)

    const currentAverage =
      key === 'workouts'
        ? values.reduce<number>(
            (sum, value) =>
              sum + (value || 0),
            0,
          )
        : average(values)

    const previousAverage =
      key === 'workouts'
        ? previous.reduce<number>(
            (sum, value) =>
              sum + (value || 0),
            0,
          )
        : average(previous)

    return {
      key,
      label,
      unit,
      values,
      currentAverage,
      comparisonPercent: change(
        currentAverage,
        previousAverage,
      ),
    }
  }

  return [
    make(
      'calories',
      'Calories',
      'avg',
      (date) =>
        nutrition.get(date)?.calories ??
        null,
    ),

    make(
      'protein',
      'Protein',
      'g avg',
      (date) =>
        nutrition.get(date)?.protein ??
        null,
    ),

    make(
      'water',
      'Water',
      'oz avg',
      (date) =>
        nutrition.get(date)?.water ??
        null,
    ),

    make(
      'workouts',
      'Workouts',
      'days',
      (date) =>
        workouts.has(date) ? 1 : 0,
    ),
  ]
}

function progress(
  inputs: Awaited<
    ReturnType<
      typeof loadProgramLogicInputs
    >
  >,
) {
  const current =
    inputs.strengthAssessments[0]
      ?.data || {}

  const previous =
    inputs.strengthAssessments[1]
      ?.data || {}

  const weight = nullableNumeric(
    current.weight,
  )

  const priorWeight =
    nullableNumeric(previous.weight)

  const bodyFat = nullableNumeric(
    current.body_fat ??
      current.bodyFat,
  )

  const priorBodyFat =
    nullableNumeric(
      previous.body_fat ??
        previous.bodyFat,
    )

  return {
    weight,

    weightChange:
      weight !== null &&
      priorWeight !== null
        ? Math.round(
            (weight - priorWeight) *
              10,
          ) / 10
        : null,

    bodyFat,

    bodyFatChange:
      bodyFat !== null &&
      priorBodyFat !== null
        ? Math.round(
            (bodyFat -
              priorBodyFat) *
              10,
          ) / 10
        : null,

    photosDue:
      !inputs.photoRecord
        ?.uploaded_at ||
      Date.now() -
        new Date(
          inputs.photoRecord.uploaded_at,
        ).getTime() >
        2592000000,

    photoUrls: inputs.photoUrls,
  }
}

function conciseInsight(
  output: Pick<
    ProgramLogicOutput,
    | 'capacityStatus'
    | 'recoveryStatus'
    | 'fuelReadiness'
    | 'hydration'
    | 'symptoms'
    | 'cycle'
    | 'workoutDecision'
  >,
) {
  if (output.symptoms.redFlag) {
    return 'A safety signal takes priority today. Pause training and seek appropriate support.'
  }

  if (
    output.fuelReadiness.status ===
    'unknown_needs_input'
  ) {
    return 'Log or eat something simple before deciding how hard to train.'
  }

  if (
    output.hydration.status === 'low'
  ) {
    return 'Hydration is the clearest readiness gap. Drink water before higher-output work.'
  }

  if (
    output.workoutDecision
      .adjustmentLevel !==
    'level_0_full_plan'
  ) {
    return output.workoutDecision
      .reasonForModification
  }

  if (
    output.capacityStatus.status ===
    'high_capacity'
  ) {
    return 'Your recovery and readiness support direct execution today.'
  }

  return (
    output.cycle.insight ||
    'The planned day matches the signals currently available.'
  )
}

export async function getProgramLogicEngine(
  args: {
    supabase: any
    user: any
    client: any
    program: ProgramTier
    dailyPlan: any
    cycleStatus: any
    cycleAdjustment: any
    plannedWorkout: any
    plannedExercises: any[]
    monthlyAssessmentsDueCount: number
  },
): Promise<ProgramLogicOutput> {
  const inputs =
    await loadProgramLogicInputs(args)

  const symptoms =
    runSymptomEngine(inputs)

  const capacityStatus =
    runCapacityEngine(
      inputs,
      symptoms,
    )

  const recoveryStatus =
    runRecoveryEngine(
      inputs,
      symptoms,
    )

  const hydration =
    runHydrationEngine(inputs)

  const nutrition =
    runNutritionEngine(inputs)

  const fuelReadiness =
    runFuelReadinessEngine(
      inputs,
      hydration,
      nutrition,
      recoveryStatus,
    )

  const cycle =
    runCycleEngine(inputs)

  const posture =
    runPostureCompensationEngine(
      inputs,
    )

  const capacityHistory =
    evaluateCapacityHistory(
      inputs.recentRecovery,
    )

  const recoveryActions =
    buildRecoveryActions({
      targetCount:
        capacityHistory.recoveryTarget,

      recoveryStatus:
        recoveryStatus.status,

      fuelStatus:
        fuelReadiness.status,

      hydrationPercent:
        hydration.percent,

      sorenessRegions: [],
    })

  // TODO: The adaptive Workout OS builder will enforce
  // exerciseTarget against the selected exercise list.
  // This orchestration layer currently exposes the target
  // and recovery actions to the dashboard.
  const workoutDecision =
    runWorkoutDecisionEngine(
      inputs,
      capacityStatus,
      recoveryStatus,
      fuelReadiness,
      hydration,
      symptoms,
      posture,
    )

  const flameState =
    runFlameExecutionEngine({
      inputs,
      hydration,
      nutrition,
      workoutDecision,
      capacity: capacityStatus,
    })

  const recovery =
    inputs.todayRecovery || {}

  const todayHealth =
    inputs.healthMetrics.today || {}

  const passiveHealth = {
    sleepDurationHours:
      nullableNumeric(todayHealth.sleep_duration?.value),
    steps:
      nullableNumeric(todayHealth.steps?.value),
    activeEnergy:
      nullableNumeric(todayHealth.active_energy?.value),
    workoutMinutes:
      nullableNumeric(todayHealth.workout?.value),
    hrv:
      nullableNumeric(todayHealth.heart_rate_variability?.value),
    restingHeartRate:
      nullableNumeric(todayHealth.resting_heart_rate?.value),
    respiratoryRate:
      nullableNumeric(todayHealth.respiratory_rate?.value),
    bodyTemperature:
      nullableNumeric(todayHealth.body_temperature?.value),
    weight:
      nullableNumeric(todayHealth.body_weight?.value),
    bodyFat:
      nullableNumeric(todayHealth.body_fat_percentage?.value),
    sources:
      Array.from(
        new Set(
          Object.values(todayHealth)
            .flatMap((metric: any) => metric?.source_providers || [])
            .filter(Boolean),
        ),
      ).map(String),
  }

  const sleepHours =
    nullableNumeric(
      recovery.sleep_hours ??
        recovery.sleep_duration_hours ??
        passiveHealth.sleepDurationHours,
    )

  const sleepQuality =
    nullableNumeric(
      recovery.sleep_quality,
    )

  const assessmentComplete =
    Boolean(
      inputs.todayRecovery
        ?.check_in_completed_at,
    )

  const passiveWorkoutComplete =
    (passiveHealth.workoutMinutes || 0) >= 10

  const recoveryComplete =
    inputs.todayRecoveryActivities
      .length > 0

  const assessmentTotal =
    1 +
    inputs.monthlyAssessmentsDueCount

  const outputBase = {
    capacityStatus,
    recoveryStatus,
    fuelReadiness,
    hydration,
    symptoms,
    cycle,
    workoutDecision,
  }

  const output: ProgramLogicOutput = {
    engineVersion:
      DASHBOARD_ENGINE_VERSION,

    generatedAt:
      new Date().toISOString(),

    client: {
      id: String(
        inputs.client.client_id,
      ),

      name: String(
        inputs.client.full_name ||
          inputs.client.first_name ||
          'there',
      ).split(' ')[0],

      age: age(
        inputs.client.birthdate,
      ),

      program: inputs.program,

      goal:
        inputs.client.primary_goal ||
        inputs.strengthAssessments[0]
          ?.data?.weight_goal ||
        inputs.client.goal ||
        null,

      baselineCapacity:
        inputs.client.capacity_state ||
        inputs.client.capacity ||
        null,
    },

    program: inputs.program,

    capacityStatus,

    recoveryStatus,

    fuelReadiness,

    workoutDecision,

    capacityHistory,

    exerciseTarget:
      capacityHistory.exerciseTarget,

    recoveryTarget:
      capacityHistory.recoveryTarget,

    recoveryActions,

    flameState,

    hydration,

    nutrition,

    workout: {
      assigned: Boolean(
        inputs.plannedWorkout,
      ),

      completed: Boolean(
        inputs.dailyPlan
          ?.workoutCompleted ||
          passiveWorkoutComplete,
      ),

      title:
        workoutDecision
          .assignedWorkout?.day_name ||
        inputs.plannedWorkout
          ?.day_name ||
        (workoutDecision
          .adjustmentLevel ===
        'level_3_recovery_training'
          ? 'Recovery movement'
          : 'Recovery day'),

      type:
        workoutDecision
          .adjustmentLevel ===
        'level_0_full_plan'
          ? inputs.plannedWorkout
              ?.workout_type ||
            inputs.plannedWorkout
              ?.focus ||
            'Training'
          : workoutDecision
              .intensityTarget,

      durationMinutes:
        nullableNumeric(
          inputs.plannedWorkout
            ?.duration_minutes ??
            inputs.plannedWorkout
              ?.estimated_duration,
        ),
    },

    assessments: {
      dailyCompleted:
        assessmentComplete,

      monthlyDueCount:
        inputs.monthlyAssessmentsDueCount,

      completionPercent:
        Math.round(
          ((assessmentComplete
            ? 1
            : 0) /
            assessmentTotal) *
            100,
        ),
    },

    recoveryCheck: {
      completed:
        recoveryComplete,

      energy: nullableNumeric(
        recovery.energy_level,
      ),

      stress: nullableNumeric(
        recovery.stress_level,
      ),

      soreness: nullableNumeric(
        recovery.soreness_level,
      ),

      sleepQuality,
    },

    sleep: {
      logged:
        sleepHours !== null ||
        sleepQuality !== null,

      hours: sleepHours,

      quality: sleepQuality,
    },

    cycle,

    symptoms,

    posture,

    todayPlan: {
      phoenixTaskIds:
        inputs.phoenixTaskIds,
    },

    insight: {
      concise:
        conciseInsight(outputBase),

      reasoning:
        workoutDecision
          .reasonForModification,
    },

    progress: progress(inputs),

    passiveHealth,

    trends: buildTrends(inputs),

    execution: {
      workoutComplete: Boolean(
        inputs.dailyPlan
          ?.workoutCompleted ||
          passiveWorkoutComplete,
      ),

      nutritionLogged:
        nutrition.dataStatus ===
        'known',

      assessmentComplete,

      recoveryComplete,

      phoenixTaskPercent:
        Math.min(
          100,
          Math.round(
            (inputs.phoenixTaskIds
              .length /
              9) *
              100,
          ),
        ),
    },

    presentation: {
      tier: inputs.program,

      complexity:
        inputs.program ===
        'phoenix'
          ? 'minimal'
          : inputs.program ===
              'ignite'
            ? 'guided'
            : 'direct',

      maxTasksPerBlock:
        inputs.program ===
          'phoenix' &&
        capacityStatus.status ===
          'low_capacity'
          ? 2
          : 3,

      showTrends:
        inputs.program ===
        'ignite',

      showInsight:
        inputs.program !==
        'ember',
    },
  }

  const persistedOutput = {
    ...output,

    progress: {
      ...output.progress,
      photoUrls: [],
    },
  }

  const { error } =
    await args.supabase
      .from(
        'dashboard_daily_recommendations',
      )
      .upsert(
        {
          user_id: inputs.userId,

          client_id:
            inputs.client.client_id,

          log_date: inputs.date,

          program: inputs.program,

          engine_version:
            DASHBOARD_ENGINE_VERSION,

          input_snapshot: {
            capacity:
              capacityStatus,

            recovery:
              recoveryStatus,

            fuel:
              fuelReadiness.status,

            symptoms:
              symptoms.severity,

            cycle:
              cycle.phase,
          },

          recommendation_output:
            persistedOutput,

          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            'user_id,client_id,log_date',
        },
      )

  if (
    error &&
    !String(error.message).includes(
      'dashboard_daily_recommendations',
    )
  ) {
    console.error(
      'Dashboard recommendation persistence failed:',
      error.message,
    )
  }

  const requirements =
    flameState.requirements

  const { error: executionError } =
    await args.supabase
      .from(
        'daily_execution_status',
      )
      .upsert(
        {
          user_id: inputs.userId,

          client_id:
            inputs.client.client_id,

          log_date: inputs.date,

          program: inputs.program,

          capacity_status:
            capacityStatus.status,

          missed_day_count:
            requirements.missedDayCount,

          required_items:
            requirements.requiredItems,

          completed_items:
            requirements.completedItems,

          completion_score:
            requirements.completionScore,

          streak_eligible:
            requirements.streakEligible,

          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            'user_id,client_id,log_date',
        },
      )

  if (
    executionError &&
    !String(
      executionError.message,
    ).includes(
      'daily_execution_status',
    )
  ) {
    console.error(
      'Daily execution persistence failed:',
      executionError.message,
    )
  }

  return output
}
