export type PhoenixCapacity = 'low' | 'medium' | 'high'

export type PhoenixMacro = {
  key: 'protein' | 'carbs' | 'fats'
  label: string
  consumed: number
  target: number
}

export type PhoenixPlanTask = {
  id: string
  label: string
  detail: string
  href: string
  complete: boolean
  secondary?: boolean
}

export type PhoenixPlanBlock = {
  id: 'morning' | 'midday' | 'evening'
  title: string
  focus: string
  tasks: PhoenixPlanTask[]
}

export type PhoenixDashboardData = {
  clientId: string
  clientName: string
  streak: number
  capacity: PhoenixCapacity
  trackLabel: string
  water: { consumed: number; target: number; increment: number }
  macros: PhoenixMacro[]
  workout: { assigned: boolean; completed: boolean; title: string }
  assessment: { completed: boolean }
  recovery: { completed: boolean }
  sleep: { logged: boolean; hours: number | null; quality: number | null }
  plan: PhoenixPlanBlock[]
  focus: { message: string; intention: string }
}
