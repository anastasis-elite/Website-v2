import { supabase } from './supabase'

const apiUrl = process.env.EXPO_PUBLIC_APP_API_URL

if (!apiUrl) {
  throw new Error('Missing EXPO_PUBLIC_APP_API_URL')
}

export type MacroProgress = {
  target: number
  consumed: number
  remaining: number
  percent: number
}

export type MobileDailyAction = {
  id: 'water' | 'nutrition' | 'check-in' | 'workout' | 'recovery'
  label: string
  status: 'complete' | 'urgent' | 'active' | 'upcoming'
  progress: number
  detail: string
  href: string
  kind: 'quick' | 'route'
  required: boolean
  primary?: boolean
  scheduleEventId?: string | null
  urgency?: 'now' | 'soon' | 'upcoming' | 'overdue' | 'none'
  start_at?: string | null
  reason?: string
  can_complete?: boolean
  can_defer?: boolean
}

export type MobileScheduleEvent = {
  id: string
  title: string
  category: string
  start_at: string
  end_at: string
  status: string
  required: boolean
  priority: string
  external: boolean
  can_complete: boolean
  can_defer: boolean
  adjusted: boolean
  adjustment_reason: string | null
  href: string
}

export type MobileDailyState = {
  engineVersion: string
  generatedAt: string
  user: {
    id: string
    clientId: string
    name: string
    program: 'ember' | 'ignite' | 'phoenix'
    goal: string | null
  }
  currentBlock: 'morning' | 'midday' | 'evening'
  summary: {
    title: string
    body: string
    adjusted: boolean
    adjustmentReason: string | null
    alert: string | null
  }
  hydration: MacroProgress & {
    status: string
    prompt: string
    recoverySupportNote: string
  }
  nutrition: {
    status: 'known' | 'needs_input'
    calories: MacroProgress
    protein: MacroProgress
    carbs: MacroProgress
    fats: MacroProgress
    remainingTargets: {
      calories: number
      protein: number
      carbs: number
      fats: number
      water: number
    }
    suggestions: string[]
    preWorkoutFuelPrompt: string
  }
  workout: {
    assigned: boolean
    completed: boolean
    title: string
    type: string
    durationMinutes: number | null
    canTrain: boolean
    adjustmentLevel: string
    intensityTarget: string
  }
  dailyCheckIn: {
    dailyCompleted: boolean
    monthlyDueCount: number
    completionPercent: number
  }
  recoveryAction: {
    completed: boolean
    target: number
    actions: Array<{ id: string; label: string; minutes?: number }>
  }
  execution: {
    score: number
    streak: number
    streakEligible: boolean
    completedActions: MobileDailyAction[]
    adjustedActions: string[]
  }
  priorities: string[]
  nextAction: MobileDailyAction
  actions: MobileDailyAction[]
  scheduleEvents: MobileScheduleEvent[]
  scheduleCompletedEvents: MobileScheduleEvent[]
  dayComplete: boolean
  closure: {
    title: string
    body: string
    next: string | null
  } | null
  alerts: string[]
  presentation: {
    tier: 'ember' | 'ignite' | 'phoenix'
    complexity: 'minimal' | 'guided' | 'direct'
    maxTasksPerBlock: number
    showTrends: boolean
    showInsight: boolean
  }
}

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('No authenticated session')
  }

  return session.access_token
}

async function mobileFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken()
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    method: init?.method || 'GET',
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      payload?.error || 'The mobile request could not be completed.',
    )
  }

  return payload as T
}

export async function getMobileDailyState() {
  return mobileFetch<MobileDailyState>('/api/mobile/schedule')
}

export async function addWater(ounces = 8) {
  return mobileFetch<{ success: true }>('/api/mobile/actions/water', {
    method: 'POST',
    body: JSON.stringify({ ounces }),
  })
}

export async function completeRecoveryAction() {
  return mobileFetch<{ success: true }>('/api/mobile/actions/recovery', {
    method: 'POST',
    body: JSON.stringify({
      activityType: 'Breathing reset',
      minutes: 5,
    }),
  })
}

export async function completeScheduleEvent(eventId: string) {
  return mobileFetch<{ success: true }>(`/api/mobile/schedule/${eventId}/complete`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function deferScheduleEvent(eventId: string) {
  return mobileFetch<{ success: true }>(`/api/mobile/schedule/${eventId}/defer`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}
