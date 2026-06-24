export type CyclePhase =
  | 'menstrual'
  | 'follicular'
  | 'ovulatory'
  | 'luteal'
  | 'extended_cycle'
  | 'menopause'
  | 'perimenopause'
  | 'unknown'

export type CapacityState =
  | 'low'
  | 'medium'
  | 'high'

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

  tags?: string[]

  cyclePhase?: CyclePhase[]
  capacity?: CapacityState[]

  minCompletions?: number
  maxCompletions?: number

  priority?: number
}

export type Meaning = {
  id: string
  text: string

  tags?: string[]

  cyclePhase?: CyclePhase[]
  capacity?: CapacityState[]

  priority?: number
}

export type IdentityShift = {
  id: string
  text: string

  tags?: string[]

  cyclePhase?: CyclePhase[]
  capacity?: CapacityState[]

  priority?: number
}

export type NextStep = {
  id: string
  text: string

  tags?: string[]

  cyclePhase?: CyclePhase[]
  capacity?: CapacityState[]

  priority?: number
}

export type BeliefChallenge = {
  id: string

  belief: string

  text: string

  tags?: string[]

  cyclePhase?: CyclePhase[]
  capacity?: CapacityState[]

  priority?: number
}
