import { supabase } from './supabase'

const apiUrl = process.env.EXPO_PUBLIC_APP_API_URL

if (!apiUrl) {
  throw new Error('Missing EXPO_PUBLIC_APP_API_URL')
}

export type MacroProgress = {
  target: number
  consumed: number
  remaining: number
}

export type MobileDashboardData = {
  client: {
    clientId: string
    program: string
    flameScore: number
  }
  rhythm: {
    phaseName: string
    message: string
  }
  insight: {
    concise?: string
    reasoning?: string
    observation?: string
    meaning?: string
    identityShift?: string
    beliefChallenge?: string
    nextStep?: string
  } | null
  macros: {
    protein: MacroProgress
    carbs: MacroProgress
    fats: MacroProgress
    calories: MacroProgress
    water: MacroProgress
  }
  cycle: {
    day: number | null
    phase: string | null
    typicalCycleLength: number
  }
  assessmentDueCount: number
}

export async function getMobileDashboard(): Promise<MobileDashboardData> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('No authenticated session')
  }

  const response = await fetch(`${apiUrl}/api/mobile/dashboard`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      Accept: 'application/json',
    },
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      payload?.error || 'The dashboard could not be loaded.'
    )
  }

  return payload as MobileDashboardData
}
