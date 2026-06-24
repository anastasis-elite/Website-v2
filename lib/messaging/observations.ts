// /lib/messaging/observations.ts

export type CyclePhase =
  | 'menstrual'
  | 'follicular'
  | 'ovulatory'
  | 'luteal'
  | 'unknown'

export type CapacityState = 'low' | 'medium' | 'high'

export type ObservationCategory =
  | 'hydration'
  | 'movement'
  | 'nutrition'
  | 'recovery'
  | 'reflection'
  | 'consistency'
  | 'momentum'
  | 'capacity'
  | 'cycle'
  | 'stress'

export type Observation = {
  id: string
  category: ObservationCategory
  text: string
  cyclePhase?: CyclePhase[]
  capacity?: CapacityState[]
  minCompletions?: number
  maxCompletions?: number
  priority?: number
}
