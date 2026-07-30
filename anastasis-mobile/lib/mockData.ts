export type ProgramTier = 'ember' | 'ignite' | 'phoenix'

export type MacroKey = 'protein' | 'carbs' | 'fats' | 'calories'

export type MacroProgress = {
  key: MacroKey
  label: string
  consumed: number
  target: number
  unit: 'g' | 'cal'
}

export type PlanTask = {
  id: string
  label: string
  detail: string
  complete: boolean
  secondary?: boolean
}

export type PlanBlock = {
  id: 'morning' | 'midday' | 'evening'
  title: string
  timing: string
  focus: string
  body: string
  tasks: PlanTask[]
}

export type WorkoutExercise = {
  id: string
  name: string
  prescription: string
  cues: string[]
  complete: boolean
}

export type MockMobileDashboard = {
  client: {
    name: string
    email: string
    program: ProgramTier
    memberSince: string
  }
  flame: {
    score: number
    label: string
    icon: string
    streak: number
  }
  rhythm: {
    title: string
    subtitle: string
    message: string
  }
  insight: {
    title: string
    observation: string
    meaning: string
    nextStep: string
  }
  water: {
    consumed: number
    target: number
    increment: number
  }
  macros: MacroProgress[]
  cycle: {
    enabled: boolean
    day: number | null
    phase: string | null
    recommendation: string
  }
  recovery: {
    status: string
    readiness: number
    recommendation: string
    completed: boolean
  }
  sleep: {
    hours: number | null
    quality: number | null
    logged: boolean
  }
  assessment: {
    dailyComplete: boolean
    monthlyDue: boolean
    dueCount: number
  }
  plan: PlanBlock[]
  workout: {
    title: string
    type: string
    durationMinutes: number
    complete: boolean
    intensityTarget: string
    adjustment: string
    fuelPrompt: string
    exercises: WorkoutExercise[]
  }
  progress: {
    weight: number | null
    bodyFat: number | null
    photosDue: boolean
    weeklyCompletion: number
  }
}

/*
 * TEMPORARY MOBILE MOCK DATA
 *
 * Phase 1 intentionally mirrors the client-facing platform visually and
 * navigationally without wiring new live business logic. Replace this adapter
 * with mobile API responses in Phase 2.
 */
export const mockDashboard: MockMobileDashboard = {
  client: {
    name: 'Alex',
    email: 'alex@example.com',
    program: 'ignite',
    memberSince: '2026-06-01',
  },
  flame: {
    score: 74,
    label: 'Strong momentum',
    icon: '🔥',
    streak: 12,
  },
  rhythm: {
    title: 'IGNITE',
    subtitle: 'Focused. Intentional. Progressing.',
    message: 'One choice at a time. Close the highest-value loops first.',
  },
  insight: {
    title: 'Protect the capacity you are building.',
    observation:
      'Consistency is improving, while recovery signals still deserve respect.',
    meaning:
      'More effort is not automatically the answer. Today works best when execution is focused.',
    nextStep:
      'Complete the next clear action, then reassess before adding more.',
  },
  water: {
    consumed: 56,
    target: 100,
    increment: 8,
  },
  macros: [
    { key: 'protein', label: 'Protein', consumed: 118, target: 175, unit: 'g' },
    { key: 'carbs', label: 'Carbs', consumed: 164, target: 240, unit: 'g' },
    { key: 'fats', label: 'Fats', consumed: 52, target: 80, unit: 'g' },
    { key: 'calories', label: 'Calories', consumed: 1710, target: 2500, unit: 'cal' },
  ],
  cycle: {
    enabled: true,
    day: 18,
    phase: 'Luteal',
    recommendation:
      'Use symptoms as the stronger signal and keep intensity responsive.',
  },
  recovery: {
    status: 'capacity supported',
    readiness: 78,
    recommendation:
      'Add a short breathing reset and keep movement quality high.',
    completed: false,
  },
  sleep: {
    hours: 7.2,
    quality: 7,
    logged: true,
  },
  assessment: {
    dailyComplete: false,
    monthlyDue: true,
    dueCount: 1,
  },
  plan: [
    {
      id: 'morning',
      title: 'Morning',
      timing: 'Start the day',
      focus: 'Hydrate, check signals, anchor protein.',
      body: 'Begin with water and the daily body signal. Keep breakfast simple and protein-forward.',
      tasks: [
        { id: 'water-am', label: 'Add first water', detail: '8-16 oz', complete: true },
        { id: 'check-in', label: 'Daily Check-In', detail: 'Sleep, energy, stress, symptoms', complete: false },
      ],
    },
    {
      id: 'midday',
      title: 'Midday',
      timing: 'Training window',
      focus: 'Train with the assigned adjustment.',
      body: 'Fuel before training and execute the current workout unless recovery guidance says otherwise.',
      tasks: [
        { id: 'fuel', label: 'Pre-workout fuel', detail: 'Carbs plus protein', complete: false },
        { id: 'workout', label: 'Workout', detail: 'Upper strength', complete: false },
      ],
    },
    {
      id: 'evening',
      title: 'Evening',
      timing: 'Close the day',
      focus: 'Recovery, sleep prep, final intake.',
      body: 'Close remaining food and water targets. Log any late symptoms before tomorrow recalculates.',
      tasks: [
        { id: 'recovery', label: 'Recovery check', detail: 'Mobility or breathing', complete: false },
        { id: 'sleep-plan', label: 'Sleep prep', detail: 'Consistent bedtime', complete: false, secondary: true },
      ],
    },
  ],
  workout: {
    title: 'Upper Strength',
    type: 'Strength hypertrophy',
    durationMinutes: 42,
    complete: false,
    intensityTarget: 'Moderate intensity',
    adjustment: 'Use planned loads unless soreness increases.',
    fuelPrompt: 'Prioritize protein and carbs before training.',
    exercises: [
      {
        id: 'press',
        name: 'Incline Dumbbell Press',
        prescription: '3 sets · 8 reps · controlled load',
        cues: ['Keep ribs down', 'Stop two reps before form breaks'],
        complete: false,
      },
      {
        id: 'row',
        name: 'Cable Row',
        prescription: '3 sets · 10 reps · moderate load',
        cues: ['Pause at the ribs', 'No shrugging'],
        complete: false,
      },
      {
        id: 'carry',
        name: 'Farmer Carry',
        prescription: '4 rounds · 40 seconds',
        cues: ['Tall posture', 'Smooth breathing'],
        complete: true,
      },
    ],
  },
  progress: {
    weight: 168,
    bodyFat: 24,
    photosDue: true,
    weeklyCompletion: 68,
  },
}

export function getMacroRemaining(macro: MacroProgress) {
  return Math.max(0, Math.round(macro.target - macro.consumed))
}

export function getPercent(consumed: number, target: number) {
  if (target <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((consumed / target) * 100)))
}
