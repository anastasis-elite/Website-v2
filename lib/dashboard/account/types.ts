export type AccountProgram = 'ember' | 'ignite' | 'phoenix'

export type JourneyMetric = {
  key: 'workouts' | 'nutrition' | 'hydration' | 'assessments' | 'recovery'
  label: string
  completed: number
  target: number
  percent: number
}

export type AccountData = {
  profile: {
    clientId: string
    name: string
    email: string
    program: AccountProgram
    avatarUrl: string | null
    capacityStatement: string
    memberSince: string | null
    subscriptionStatus: string | null
  }
  streak: number
  flame: { score: number; state: string; message: string }
  summary: {
    totalCompletedDays: number
    goalProgressPercent: number | null
    workoutsCompleted: number
    waterAverageOz: number | null
    recoveryAveragePercent: number | null
  }
  journey: {
    averageCompletionPercent: number
    metrics: JourneyMetric[]
  }
}

export type AccountProfileFormData = {
  full_name: string | null
  email: string | null
  birthdate: string | null
  birthdate_updated_once: boolean
  address_line_1: string | null
  address_line_2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  reproductive_status: string | null
  last_period_start: string | null
  average_cycle_length: number | null
}
