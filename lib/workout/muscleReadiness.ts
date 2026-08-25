import { getTierCapabilities } from '@/lib/entitlements'
import type { ProgramTier } from '@/lib/dashboard/logic/types'
import type { CanonicalMuscle, SorenessRegionKey } from '@/lib/workout-os/types'

export type MuscleReadinessState =
  | 'ready'
  | 'available'
  | 'recovering'
  | 'rest'
  | 'unknown'

export type MuscleId =
  | 'left_upper_traps'
  | 'right_upper_traps'
  | 'left_anterior_deltoid'
  | 'right_anterior_deltoid'
  | 'left_lateral_deltoid'
  | 'right_lateral_deltoid'
  | 'left_pectoralis_major'
  | 'right_pectoralis_major'
  | 'left_biceps'
  | 'right_biceps'
  | 'left_triceps'
  | 'right_triceps'
  | 'left_forearms'
  | 'right_forearms'
  | 'rectus_abdominis'
  | 'left_external_oblique'
  | 'right_external_oblique'
  | 'left_lat_region'
  | 'right_lat_region'
  | 'erector_spinae_region'
  | 'left_glute_max'
  | 'right_glute_max'
  | 'left_glute_medius'
  | 'right_glute_medius'
  | 'left_quadriceps'
  | 'right_quadriceps'
  | 'left_hamstrings'
  | 'right_hamstrings'
  | 'left_adductors'
  | 'right_adductors'
  | 'left_calves'
  | 'right_calves'
  | 'left_tibialis_anterior'
  | 'right_tibialis_anterior'

export type MuscleRegionDefinition = {
  id: MuscleId
  label: string
  canonicalMuscles: CanonicalMuscle[]
  view: 'front' | 'posterior'
  side?: 'left' | 'right' | 'center'
}

export type MuscleReadiness = {
  muscleId: MuscleId
  readinessScore?: number
  state: MuscleReadinessState
  lastTrainedAt?: string
  recentTrainingLoad?: number
  soreness?: number
  recoveryEstimate?: number
  confidence?: number
  reasons?: string[]
  exercisesToday?: string[]
}

type ExerciseLike = {
  exercise?: string
  name?: string
  display_name?: string
  primary_muscles?: string[]
  secondary_muscles?: string[]
  intended_muscles?: string[]
  sets?: number | string
  reps?: number | string
  recommended_reps?: number | string
  target_reps?: number | string
}

type WorkoutHistoryRow = {
  workout_date?: string
  completed?: boolean
  exercise_logs?: ExerciseLike[]
}

type RecoverySignal = {
  log_date?: string
  date?: string
  soreness_level?: number | string | null
  soreness?: number | string | null
  soreness_regions?: string[] | null
  sorenessRegions?: SorenessRegionKey[]
}

export const MUSCLE_REGIONS: MuscleRegionDefinition[] = [
  { id: 'left_upper_traps', label: 'Left upper traps', canonicalMuscles: ['upper_traps'], view: 'front', side: 'left' },
  { id: 'right_upper_traps', label: 'Right upper traps', canonicalMuscles: ['upper_traps'], view: 'front', side: 'right' },
  { id: 'left_anterior_deltoid', label: 'Left anterior deltoid', canonicalMuscles: ['shoulders'], view: 'front', side: 'left' },
  { id: 'right_anterior_deltoid', label: 'Right anterior deltoid', canonicalMuscles: ['shoulders'], view: 'front', side: 'right' },
  { id: 'left_lateral_deltoid', label: 'Left lateral deltoid', canonicalMuscles: ['shoulders'], view: 'front', side: 'left' },
  { id: 'right_lateral_deltoid', label: 'Right lateral deltoid', canonicalMuscles: ['shoulders'], view: 'front', side: 'right' },
  { id: 'left_pectoralis_major', label: 'Left pectoralis major', canonicalMuscles: ['chest'], view: 'front', side: 'left' },
  { id: 'right_pectoralis_major', label: 'Right pectoralis major', canonicalMuscles: ['chest'], view: 'front', side: 'right' },
  { id: 'left_biceps', label: 'Left biceps', canonicalMuscles: ['biceps'], view: 'front', side: 'left' },
  { id: 'right_biceps', label: 'Right biceps', canonicalMuscles: ['biceps'], view: 'front', side: 'right' },
  { id: 'left_triceps', label: 'Left triceps', canonicalMuscles: ['triceps'], view: 'posterior', side: 'left' },
  { id: 'right_triceps', label: 'Right triceps', canonicalMuscles: ['triceps'], view: 'posterior', side: 'right' },
  { id: 'left_forearms', label: 'Left forearm region', canonicalMuscles: ['forearms'], view: 'front', side: 'left' },
  { id: 'right_forearms', label: 'Right forearm region', canonicalMuscles: ['forearms'], view: 'front', side: 'right' },
  { id: 'rectus_abdominis', label: 'Rectus abdominis', canonicalMuscles: ['core'], view: 'front', side: 'center' },
  { id: 'left_external_oblique', label: 'Left external oblique region', canonicalMuscles: ['core'], view: 'front', side: 'left' },
  { id: 'right_external_oblique', label: 'Right external oblique region', canonicalMuscles: ['core'], view: 'front', side: 'right' },
  { id: 'left_lat_region', label: 'Left latissimus region', canonicalMuscles: ['lats', 'upper_back'], view: 'posterior', side: 'left' },
  { id: 'right_lat_region', label: 'Right latissimus region', canonicalMuscles: ['lats', 'upper_back'], view: 'posterior', side: 'right' },
  { id: 'erector_spinae_region', label: 'Erector-spinae region', canonicalMuscles: ['lower_back'], view: 'posterior', side: 'center' },
  { id: 'left_glute_max', label: 'Left gluteus maximus', canonicalMuscles: ['glutes'], view: 'posterior', side: 'left' },
  { id: 'right_glute_max', label: 'Right gluteus maximus', canonicalMuscles: ['glutes'], view: 'posterior', side: 'right' },
  { id: 'left_glute_medius', label: 'Left gluteus medius region', canonicalMuscles: ['glutes'], view: 'front', side: 'left' },
  { id: 'right_glute_medius', label: 'Right gluteus medius region', canonicalMuscles: ['glutes'], view: 'front', side: 'right' },
  { id: 'left_quadriceps', label: 'Left quadriceps', canonicalMuscles: ['quads'], view: 'front', side: 'left' },
  { id: 'right_quadriceps', label: 'Right quadriceps', canonicalMuscles: ['quads'], view: 'front', side: 'right' },
  { id: 'left_hamstrings', label: 'Left hamstrings', canonicalMuscles: ['hamstrings'], view: 'posterior', side: 'left' },
  { id: 'right_hamstrings', label: 'Right hamstrings', canonicalMuscles: ['hamstrings'], view: 'posterior', side: 'right' },
  { id: 'left_adductors', label: 'Left adductors', canonicalMuscles: ['adductors'], view: 'front', side: 'left' },
  { id: 'right_adductors', label: 'Right adductors', canonicalMuscles: ['adductors'], view: 'front', side: 'right' },
  { id: 'left_calves', label: 'Left calves', canonicalMuscles: ['calves'], view: 'posterior', side: 'left' },
  { id: 'right_calves', label: 'Right calves', canonicalMuscles: ['calves'], view: 'posterior', side: 'right' },
  { id: 'left_tibialis_anterior', label: 'Left tibialis anterior region', canonicalMuscles: ['feet_ankles'], view: 'front', side: 'left' },
  { id: 'right_tibialis_anterior', label: 'Right tibialis anterior region', canonicalMuscles: ['feet_ankles'], view: 'front', side: 'right' },
]

const CANONICAL_MUSCLES = new Set<CanonicalMuscle>([
  'neck', 'upper_traps', 'shoulders', 'chest', 'upper_back', 'lats', 'rhomboids',
  'biceps', 'triceps', 'forearms', 'lower_back', 'core', 'glutes', 'hip_flexors',
  'quads', 'hamstrings', 'adductors', 'calves', 'feet_ankles',
])

const aliases: Record<string, CanonicalMuscle[]> = {
  traps: ['upper_traps'],
  trapezius: ['upper_traps'],
  delts: ['shoulders'],
  deltoids: ['shoulders'],
  anterior_deltoid: ['shoulders'],
  lateral_deltoid: ['shoulders'],
  posterior_deltoid: ['shoulders'],
  pecs: ['chest'],
  pectorals: ['chest'],
  pectoralis_major: ['chest'],
  abs: ['core'],
  abdominals: ['core'],
  obliques: ['core'],
  trunk: ['core'],
  erectors: ['lower_back'],
  erector_spinae: ['lower_back'],
  back: ['upper_back', 'lats'],
  rhomboid: ['rhomboids', 'upper_back'],
  lats: ['lats'],
  latissimus: ['lats'],
  glute_max: ['glutes'],
  glute_medius: ['glutes'],
  gluteus_maximus: ['glutes'],
  gluteus_medius: ['glutes'],
  quadriceps: ['quads'],
  quad: ['quads'],
  posterior_chain: ['glutes', 'hamstrings', 'lower_back'],
  legs: ['quads', 'hamstrings', 'glutes'],
  lower_body: ['quads', 'hamstrings', 'glutes', 'adductors', 'calves'],
  calves: ['calves'],
  gastrocnemius: ['calves'],
  soleus: ['calves'],
  tibialis: ['feet_ankles'],
}

const nameRules: Array<{ pattern: RegExp; muscles: CanonicalMuscle[] }> = [
  { pattern: /squat|leg press|lunge|split squat|step[- ]?up|leg extension/i, muscles: ['quads', 'glutes'] },
  { pattern: /deadlift|rdl|hinge|good morning|back extension/i, muscles: ['hamstrings', 'glutes', 'lower_back'] },
  { pattern: /hip thrust|glute bridge|kickback|abduction/i, muscles: ['glutes'] },
  { pattern: /adduction|adductor/i, muscles: ['adductors'] },
  { pattern: /calf raise|calves/i, muscles: ['calves'] },
  { pattern: /tibialis|toe raise/i, muscles: ['feet_ankles'] },
  { pattern: /bench|push[- ]?up|chest press|fly|incline press/i, muscles: ['chest', 'shoulders', 'triceps'] },
  { pattern: /shoulder press|front raise/i, muscles: ['shoulders', 'triceps'] },
  { pattern: /lateral raise/i, muscles: ['shoulders'] },
  { pattern: /row|pulldown|pull[- ]?up|lat/i, muscles: ['lats', 'upper_back', 'biceps'] },
  { pattern: /curl/i, muscles: ['biceps', 'forearms'] },
  { pattern: /tricep|pressdown|pulldown|skull/i, muscles: ['triceps'] },
  { pattern: /carry|plank|crunch|dead bug|pallof|rotation|woodchop/i, muscles: ['core'] },
]

function normalize(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function numeric(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function exerciseName(exercise: ExerciseLike) {
  return String(exercise.display_name || exercise.name || exercise.exercise || 'Exercise')
}

export function normalizeExerciseMuscles(exercise: ExerciseLike): CanonicalMuscle[] {
  const mapped = [
    ...(exercise.primary_muscles || []),
    ...(exercise.secondary_muscles || []),
    ...(exercise.intended_muscles || []),
  ].flatMap((value) => {
    const key = normalize(value)
    if (CANONICAL_MUSCLES.has(key as CanonicalMuscle)) return [key as CanonicalMuscle]
    return aliases[key] || []
  })

  if (mapped.length) return Array.from(new Set(mapped))

  const name = exerciseName(exercise)
  return Array.from(new Set(nameRules.flatMap((rule) => (rule.pattern.test(name) ? rule.muscles : []))))
}

export function getMuscleIdsForExercise(exercise: ExerciseLike): MuscleId[] {
  const muscles = normalizeExerciseMuscles(exercise)
  return MUSCLE_REGIONS.filter((region) =>
    region.canonicalMuscles.some((muscle) => muscles.includes(muscle)),
  ).map((region) => region.id)
}

function trainingLoad(exercise: ExerciseLike) {
  const sets = numeric(exercise.sets) || 1
  const reps = numeric(exercise.recommended_reps ?? exercise.reps ?? exercise.target_reps) || 1
  return Math.max(1, sets * reps)
}

function daysBetween(date: string, now: Date) {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return null
  return Math.max(0, Math.floor((now.getTime() - parsed.getTime()) / 86400000))
}

export function canShowMuscleReadinessDetail(tier: ProgramTier) {
  return getTierCapabilities(tier).recoveryRecommendation
}

export function buildMuscleReadiness({
  tier,
  todaysExercises,
  workoutHistory,
  recoverySignals,
  now = new Date(),
}: {
  tier: ProgramTier
  todaysExercises: ExerciseLike[]
  workoutHistory: WorkoutHistoryRow[]
  recoverySignals: RecoverySignal[]
  now?: Date
}): MuscleReadiness[] {
  const detailEnabled = canShowMuscleReadinessDetail(tier)
  const todayNames = new Map<MuscleId, string[]>()

  todaysExercises.forEach((exercise) => {
    getMuscleIdsForExercise(exercise).forEach((muscleId) => {
      todayNames.set(muscleId, [...(todayNames.get(muscleId) || []), exerciseName(exercise)])
    })
  })

  const loadByMuscle = new Map<MuscleId, number>()
  const lastByMuscle = new Map<MuscleId, string>()

  workoutHistory.filter((row) => row.completed !== false).forEach((row) => {
    const date = String(row.workout_date || '')
    const ageDays = daysBetween(date, now)
    if (ageDays === null) return

    ;(row.exercise_logs || []).forEach((exercise) => {
      getMuscleIdsForExercise(exercise).forEach((muscleId) => {
        const previous = lastByMuscle.get(muscleId)
        if (!previous || new Date(date).getTime() > new Date(previous).getTime()) {
          lastByMuscle.set(muscleId, date)
        }
        if (ageDays <= 4) {
          const weight = ageDays <= 1 ? 1 : ageDays <= 2 ? 0.72 : 0.42
          loadByMuscle.set(muscleId, (loadByMuscle.get(muscleId) || 0) + trainingLoad(exercise) * weight)
        }
      })
    })
  })

  const sorenessByMuscle = new Map<MuscleId, number>()
  recoverySignals.forEach((signal) => {
    const soreness = numeric(signal.soreness_level ?? signal.soreness)
    const regions = signal.soreness_regions || signal.sorenessRegions || []
    regions.forEach((region) => {
      const canonical = normalizeExerciseMuscles({ primary_muscles: [region] })
      MUSCLE_REGIONS.filter((item) =>
        item.canonicalMuscles.some((muscle) => canonical.includes(muscle)),
      ).forEach((item) => {
        sorenessByMuscle.set(item.id, Math.max(sorenessByMuscle.get(item.id) || 0, soreness))
      })
    })
  })

  return MUSCLE_REGIONS.map((region) => {
    const lastTrainedAt = lastByMuscle.get(region.id)
    const recentTrainingLoad = Math.round(loadByMuscle.get(region.id) || 0)
    const soreness = sorenessByMuscle.get(region.id)
    const ageDays = lastTrainedAt ? daysBetween(lastTrainedAt, now) : null
    const reasons: string[] = []
    let state: MuscleReadinessState = 'unknown'
    let readinessScore: number | undefined

    if (soreness && soreness >= 7) {
      state = 'rest'
      readinessScore = 20
      reasons.push('Soreness check-in is elevated.')
    } else if ((soreness && soreness >= 5) || recentTrainingLoad >= 80 || (ageDays !== null && ageDays <= 1)) {
      state = 'recovering'
      readinessScore = 45
      if (soreness && soreness >= 5) reasons.push('Recent soreness is logged here.')
      if (recentTrainingLoad >= 80 || (ageDays !== null && ageDays <= 1)) reasons.push('Recent training load is still close.')
    } else if (recentTrainingLoad > 0 || ageDays !== null) {
      state = ageDays !== null && ageDays >= 3 ? 'ready' : 'available'
      readinessScore = state === 'ready' ? 82 : 64
      if (ageDays !== null) reasons.push(`Last trained ${ageDays === 0 ? 'today' : `${ageDays} day${ageDays === 1 ? '' : 's'} ago`}.`)
    }

    if (!detailEnabled) {
      return {
        muscleId: region.id,
        state: todayNames.has(region.id) ? 'available' : 'unknown',
        exercisesToday: todayNames.get(region.id),
        reasons: todayNames.has(region.id) ? ['Included in today’s workout.'] : ['Detailed readiness is available with guided recovery tiers.'],
      }
    }

    return {
      muscleId: region.id,
      readinessScore,
      state,
      lastTrainedAt,
      recentTrainingLoad: recentTrainingLoad || undefined,
      soreness,
      confidence: state === 'unknown' ? 0.25 : 0.68,
      reasons: reasons.length ? reasons : ['Not enough recent data yet.'],
      exercisesToday: todayNames.get(region.id),
    }
  })
}

export function summarizeWorkoutMuscleFocus(exercises: ExerciseLike[]) {
  const counts = new Map<CanonicalMuscle, number>()
  exercises.forEach((exercise) => {
    normalizeExerciseMuscles(exercise).forEach((muscle) => {
      counts.set(muscle, (counts.get(muscle) || 0) + 1)
    })
  })
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([muscle]) => muscle)
}
