export type WorkoutTab = 'progress' | 'strength' | 'recovery' | 'history'
export type WorkoutViewPreferences = { tab: WorkoutTab; mode: 'recommended' | 'manual' }

export function parseWorkoutViewPreferences(value: string | null): WorkoutViewPreferences {
  let stored: any = null
  try { stored = JSON.parse(value || 'null') } catch { /* Ignore damaged preferences. */ }
  return {
    tab: ['progress', 'strength', 'recovery', 'history'].includes(stored?.tab) ? stored.tab : 'progress',
    mode: stored?.mode === 'manual' ? 'manual' : 'recommended',
  }
}
