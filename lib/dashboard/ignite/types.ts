export type IgniteMacro = {
  key: 'protein' | 'carbs' | 'fats' | 'calories'
  label: string
  consumed: number
  target: number
  unit: 'g' | 'cal'
}

export type IgnitePlanTask = {
  id: string
  label: string
  href: string
  complete: boolean
  autoTracked: boolean
}

export type IgnitePlanBlock = {
  id: 'morning' | 'midday' | 'evening'
  title: string
  focus: string
  tasks: IgnitePlanTask[]
}

export type IgniteTrend = {
  key: 'calories' | 'protein' | 'water' | 'workouts'
  label: string
  unit: string
  values: Array<number | null>
  currentAverage: number | null
  comparisonPercent: number | null
}

export type IgniteDashboardData = {
  clientId: string
  clientName: string
  streak: number
  water: { consumed: number; target: number }
  macros: IgniteMacro[]
  workout: {
    assigned: boolean
    completed: boolean
    title: string
    type: string
    durationMinutes: number | null
  }
  assessment: {
    dailyCompleted: boolean
    monthlyDueCount: number
    completedPercent: number
  }
  recovery: {
    completed: boolean
    energy: number | null
    stress: number | null
    sleep: number | null
    soreness: number | null
  }
  cycle: {
    enabled: boolean
    phase: string | null
    day: number | null
    recommendation: string | null
  }
  plan: IgnitePlanBlock[]
  trends: IgniteTrend[]
  progress: {
    weight: number | null
    weightChange: number | null
    bodyFat: number | null
    bodyFatChange: number | null
    photosDue: boolean
    photoUrls: string[]
  }
  baseInsight: string | null
}
