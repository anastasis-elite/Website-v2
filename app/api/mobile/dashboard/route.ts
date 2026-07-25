type MobileDashboardPayload = {
  client: {
    clientId: string
    program: 'ember' | 'ignite' | 'phoenix'
    flameScore: number
  }

  rhythm: {
    phaseName: string
    message: string
  }

  insight: {
    concise: string
    reasoning: string
    observation?: string
    meaning?: string
    identityShift?: string
    beliefChallenge?: string
    nextStep?: string
  }

  macros: {
    protein: {
      target: number
      consumed: number
      remaining: number
    }
    carbs: {
      target: number
      consumed: number
      remaining: number
    }
    fats: {
      target: number
      consumed: number
      remaining: number
    }
    calories: {
      target: number
      consumed: number
      remaining: number
    }
    water: {
      target: number
      consumed: number
      remaining: number
    }
  }

  cycle: {
    day: number | null
    phase: string | null
    typicalCycleLength: number
  }

  assessmentDueCount: number
}
