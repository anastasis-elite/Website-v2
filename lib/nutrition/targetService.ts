import { calculateNutritionTargets, inchesToCm, poundsToKg, type NutritionTargetResult, type WearableDayInput } from './targetEngine'

type QueryResult<T> = { data: T | null; error?: { message: string } | null }

type QueryBuilder<T> = {
  then<TResult1 = QueryResult<T[]>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>
  select(columns: string): QueryBuilder<T>
  eq(column: string, value: unknown): QueryBuilder<T>
  gte(column: string, value: unknown): QueryBuilder<T>
  lte(column: string, value: unknown): QueryBuilder<T>
  in(column: string, values: unknown[]): QueryBuilder<T>
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T>
  limit(count: number): QueryBuilder<T>
  maybeSingle(): Promise<QueryResult<T>>
}

type SupabaseReader = {
  from(table: string): unknown
}

type AssessmentRow = {
  data?: Record<string, unknown> | null
  submitted_at?: string | null
}

type ClientRow = {
  client_id?: string | null
  birthdate?: string | null
  sex?: string | null
  gender?: string | null
  primary_goal?: string | null
  goal?: string | null
  workout_days_available?: number | string | null
  current_workout_days_per_week?: number | string | null
  current_workout_minutes_per_session?: number | string | null
}

type DailyHealthMetricRow = {
  metric_date: string
  metric_type: string
  value: number | string | null
  source_providers?: string[] | null
  metadata?: Record<string, unknown> | null
}

type HealthIntegrationRow = {
  provider: string
  connection_status: string | null
  permission_status: string | null
  last_successful_sync_at?: string | null
}

function numeric(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function table<T>(supabase: SupabaseReader, name: string) {
  return supabase.from(name) as QueryBuilder<T>
}

export function normalizeCyclePhase(value: unknown) {
  const phase = stringValue(value)
  return phase === 'menstrual' ||
    phase === 'follicular' ||
    phase === 'ovulatory' ||
    phase === 'luteal'
    ? phase
    : 'unknown'
}

export function calculateAgeFromBirthdate(birthdate?: string | null, now = new Date()) {
  if (!birthdate) return null
  const birth = new Date(birthdate)
  if (Number.isNaN(birth.getTime())) return null

  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1
  return age > 0 ? age : null
}

function metabolicSex(client: ClientRow, assessmentData: Record<string, unknown>) {
  const raw = stringValue(assessmentData.sex) || stringValue(assessmentData.gender) || client.sex || client.gender
  return String(raw || '').toLowerCase() === 'male' ? 'male' as const : 'female' as const
}

function dateOffset(daysAgo: number, now = new Date()) {
  const date = new Date(now)
  date.setUTCDate(date.getUTCDate() - daysAgo)
  return date.toISOString().slice(0, 10)
}

function mapDailyHealthMetrics(rows: DailyHealthMetricRow[]): WearableDayInput[] {
  const byDate = new Map<string, WearableDayInput>()

  for (const row of rows) {
    const current = byDate.get(row.metric_date) || {
      date: row.metric_date,
      activeEnergyKcal: null,
    }
    const value = numeric(row.value)
    const source = row.source_providers?.join(', ') || null

    if (row.metric_type === 'active_energy') current.activeEnergyKcal = value
    if (row.metric_type === 'resting_energy') current.restingEnergyKcal = value
    if (row.metric_type === 'steps') current.steps = value
    if (row.metric_type === 'workout') {
      current.workoutDurationMinutes = value
      const types = Array.isArray(row.metadata?.types) ? row.metadata.types : []
      current.workoutType = types.map(String).filter(Boolean).join(', ') || null
    }
    if (source) current.dataSource = source

    byDate.set(row.metric_date, current)
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function resolveWeightKg({
  strengthData,
  healthRows,
}: {
  strengthData: Record<string, unknown>
  healthRows: DailyHealthMetricRow[]
}) {
  const assessmentWeightLbs = numeric(strengthData.weight)
  if (assessmentWeightLbs && assessmentWeightLbs > 0) return poundsToKg(assessmentWeightLbs)

  const latestHealthWeight = [...healthRows]
    .filter((row) => row.metric_type === 'body_weight' && numeric(row.value))
    .sort((a, b) => b.metric_date.localeCompare(a.metric_date))[0]

  const healthWeight = numeric(latestHealthWeight?.value)
  if (!healthWeight) return null
  return healthWeight > 90 ? poundsToKg(healthWeight) : healthWeight
}

function resolveBodyFatPercent(strengthData: Record<string, unknown>, healthRows: DailyHealthMetricRow[]) {
  const assessmentBodyFat =
    numeric(strengthData.body_fat_percentage) ??
    numeric(strengthData.bodyFatPercent) ??
    numeric(strengthData.body_fat)
  if (assessmentBodyFat !== null) return assessmentBodyFat

  const latestHealthBodyFat = [...healthRows]
    .filter((row) => row.metric_type === 'body_fat_percentage' && numeric(row.value))
    .sort((a, b) => b.metric_date.localeCompare(a.metric_date))[0]

  return numeric(latestHealthBodyFat?.value)
}

function wearableConnected(integrations: HealthIntegrationRow[]) {
  return integrations.some((row) => row.connection_status === 'connected' && row.permission_status !== 'denied')
}

function wearablePermissionDenied(integrations: HealthIntegrationRow[]) {
  return integrations.some((row) => row.permission_status === 'denied')
}

export function nutritionLogAuditFields(target: NutritionTargetResult) {
  void target
  return {}
}

export async function calculateClientNutritionTargets({
  supabase,
  clientId,
  program,
}: {
  supabase: SupabaseReader
  clientId: string
  program?: string
}) {
  const now = new Date()
  const startDate = dateOffset(21, now)
  const endDate = dateOffset(1, now)

  const [
    strengthResult,
    initialResult,
    clientResult,
    cycleResult,
    healthMetricsResult,
    healthIntegrationsResult,
  ] = await Promise.all([
    table<AssessmentRow>(supabase, 'assessments')
      .select('*')
      .eq('client_id', clientId)
      .eq('assessment_type', 'strength')
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    table<AssessmentRow>(supabase, 'assessments')
      .select('*')
      .eq('client_id', clientId)
      .eq('assessment_type', 'initial')
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    table<ClientRow>(supabase, 'clients')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle(),
    table<Record<string, unknown>>(supabase, 'cycle_logs')
      .select('phase')
      .eq('client_id', clientId)
      .order('log_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    table<DailyHealthMetricRow>(supabase, 'daily_health_metrics')
      .select('*')
      .eq('client_id', clientId)
      .in('metric_type', ['active_energy', 'resting_energy', 'steps', 'workout', 'body_weight', 'body_fat_percentage'])
      .gte('metric_date', startDate)
      .lte('metric_date', endDate),
    table<HealthIntegrationRow>(supabase, 'health_integrations')
      .select('*')
      .eq('client_id', clientId),
  ])

  const strengthData = strengthResult.data?.data || {}
  const initialData = initialResult.data?.data || {}
  const client = clientResult.data || {}
  const healthRows = Array.isArray(healthMetricsResult.data) ? healthMetricsResult.data : []
  const integrations = Array.isArray(healthIntegrationsResult.data) ? healthIntegrationsResult.data : []
  const trainingFrequency =
    numeric(initialData.trainingDays) ??
    numeric(client.workout_days_available) ??
    numeric(client.current_workout_days_per_week)
  const trainingDuration = numeric(client.current_workout_minutes_per_session)
  const goalValue =
    stringValue(strengthData.weight_goal) ||
    stringValue(initialData.primaryFocus) ||
    stringValue(client.primary_goal) ||
    stringValue(client.goal)

  const target = calculateNutritionTargets({
    age: calculateAgeFromBirthdate(stringValue(strengthData.birthdate) || client.birthdate, now) ?? 35,
    metabolicSex: metabolicSex(client, { ...initialData, ...strengthData }),
    heightCm: numeric(strengthData.height_cm) ?? (numeric(strengthData.height_in) ? inchesToCm(Number(strengthData.height_in)) : null),
    weightKg: resolveWeightKg({ strengthData, healthRows }),
    bodyFatPercent: resolveBodyFatPercent(strengthData, healthRows),
    goalValue,
    assessedActivityLevel:
      stringValue(initialData.activity_level) ||
      stringValue(initialData.activityLevel) ||
      stringValue(initialData.experienceLevel),
    trainingFrequencyDaysPerWeek: trainingFrequency,
    trainingDurationMinutes: trainingDuration,
    wearableConnected: wearableConnected(integrations),
    wearablePermissionDenied: wearablePermissionDenied(integrations),
    wearableDays: mapDailyHealthMetrics(healthRows),
    calculatedAt: now,
  })

  const weightLbs = target.inputs.weightKg ? Math.round(target.inputs.weightKg / 0.45359237) : 150
  const water = Math.round(weightLbs * 0.6)

  return {
    client_id: clientId,
    program: program || '',
    phase: normalizeCyclePhase(cycleResult.data?.phase),
    water,
    weightLbs,
    target,
  }
}
