import type { ProgramTier } from '@/lib/entitlements'

export type DirectEntryLog = {
  id: string
  client_id: string
  log_date: string
  water_oz?: number | string | null
  water_consumed_oz?: number | string | null
}

export const directEntryLogColumns = 'id,client_id,log_date,water_oz,water_consumed_oz'

export type DirectWaterEntry = { clientId: string; logDate: string; target: number; consumed: number }

export async function readDirectWaterEntry(clientId: string, logDate: string, signal?: AbortSignal, request = fetch): Promise<DirectWaterEntry> {
  const response = await request(`/api/nutrition/hydration?clientId=${encodeURIComponent(clientId)}&logDate=${encodeURIComponent(logDate)}`, { signal, cache: 'no-store' })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.error || 'Today’s hydration could not be loaded.')
  signal?.throwIfAborted()
  if (body?.clientId !== clientId || body?.logDate !== logDate) throw new Error('The logging day changed. Reload to open today’s water entry.')
  if (typeof body.target !== 'number' || !Number.isFinite(body.target) || body.target <= 0
    || typeof body.consumed !== 'number' || !Number.isFinite(body.consumed) || body.consumed < 0) {
    throw new Error('Today’s hydration target or saved intake could not be confirmed.')
  }
  return body
}

export async function readDirectEntryLog(supabase: any, clientId: string, logDate: string): Promise<DirectEntryLog | null> {
  const { data, error } = await supabase.from('nutrition_logs').select(directEntryLogColumns)
    .eq('client_id', clientId).eq('log_date', logDate).maybeSingle()
  if (error) throw new Error('Today’s saved nutrition could not be loaded.')
  return data ? validatedLog(data, clientId, logDate) : null
}

function validatedLog(log: unknown, clientId: string, logDate: string): DirectEntryLog {
  if (!log || typeof log !== 'object' || Array.isArray(log)) throw new Error('Today’s food entry could not be prepared.')
  const entry = log as DirectEntryLog
  if (typeof entry.id !== 'string' || !entry.id || entry.client_id !== clientId || entry.log_date !== logDate) {
    throw new Error('The logging day changed. Reload to open today’s food entry.')
  }
  return entry
}

// Called only when the authorized daily-log read was empty. Retain the existing
// target and log APIs; never overwrite a log created while targets were loading.
export async function prepareDirectFoodEntry({ supabase, clientId, logDate, program, signal, request = fetch }: {
  supabase: any
  clientId: string
  logDate: string
  program: ProgramTier
  signal?: AbortSignal
  request?: typeof fetch
}): Promise<DirectEntryLog> {
  if (program === 'ember') throw new Error('Food and meal logging require IGNITE or PHOENIX.')
  const targetsResponse = await request(`/api/nutrition?client_id=${encodeURIComponent(clientId)}&program=${encodeURIComponent(program)}`, { signal })
  const targets = await targetsResponse.json().catch(() => null)
  if (!targetsResponse.ok) throw new Error(targets?.error || 'Today’s nutrition targets could not be prepared.')
  if (![targets?.protein, targets?.carbs, targets?.fats].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)
    || typeof targets?.calories !== 'number' || !Number.isFinite(targets.calories) || targets.calories <= 0) {
    throw new Error('Today’s nutrition targets could not be prepared.')
  }
  signal?.throwIfAborted()
  const existing = await readDirectEntryLog(supabase, clientId, logDate)
  signal?.throwIfAborted()
  if (existing) return validatedLog(existing, clientId, logDate)
  const response = await request('/api/nutrition-log', {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId, log_date: logDate, protein: targets.protein, carbs: targets.carbs,
      createOnly: true,
      fats: targets.fats, calories: targets.calories, water_oz: targets.water,
      meals: [], completed: false, cyclePhase: targets.phase,
      nutritionCalculation: targets.nutritionCalculation,
      trainingLevel: program === 'phoenix' ? 'recovery' : 'strength_hypertrophy',
    }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.error || 'Today’s food entry could not be prepared.')
  signal?.throwIfAborted()
  return validatedLog(payload?.nutritionLog, clientId, logDate)
}
