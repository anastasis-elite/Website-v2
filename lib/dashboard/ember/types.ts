export type EmberMacroKey = 'protein' | 'carbs' | 'fats' | 'calories'

export type EmberMacro = {
  key: EmberMacroKey
  label: string
  consumed: number
  target: number
  unit: 'g' | 'cal'
}

export type EmberTodayWorkout = {
  name: string
  type: string
  assigned: boolean
  completed: boolean
}

export type EmberDashboardData = {
  clientId: string
  clientName: string
  streak: number
  water: {
    consumed: number
    target: number
    increment: number
  }
  macros: EmberMacro[]
  workout: EmberTodayWorkout
  assessment: {
    required: boolean
    completed: boolean
    label: string
  }
  recovery: {
    required: boolean
    completed: boolean
    label: string
  }
}
