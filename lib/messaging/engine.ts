// /lib/messaging/engine.ts

import { observationLibrary } from './observations'
import { meaningLibrary } from './meanings'
import { identityShiftLibrary } from './identityShifts'
import { nextStepLibrary } from './nextSteps'
import { beliefChallengeLibrary } from './beliefChallenges'
import {
  CapacityState,
  CyclePhase,
} from './types'

type InsightInput = {
  cyclePhase: CyclePhase || 'none'
  capacity: CapacityState
  completions: number
  belief?: string
}

function matchesItem(
  item: {
    cyclePhase?: CyclePhase[]
    capacity?: CapacityState[]
    minCompletions?: number
    maxCompletions?: number
    priority?: number
    belief?: string
  },
  input: InsightInput
) {
  const matchesPhase =
   !item.cyclePhase ||
    (input.cyclePhase !== 'none' && item.cyclePhase.includes(input.cyclePhase))

  const matchesCapacity =
    !item.capacity || item.capacity.includes(input.capacity)

  const matchesMin =
    item.minCompletions === undefined ||
    input.completions >= item.minCompletions

  const matchesMax =
    item.maxCompletions === undefined ||
    input.completions <= item.maxCompletions

  const matchesBelief =
    !item.belief || item.belief === input.belief

  return (
    matchesPhase &&
    matchesCapacity &&
    matchesMin &&
    matchesMax &&
    matchesBelief
  )
}

function chooseBest<T extends { priority?: number }>(items: T[]) {
  return [...items].sort(
    (a, b) => (b.priority || 0) - (a.priority || 0)
  )[0]
}

export function generateDailyInsight(input: InsightInput) {
  const observation = chooseBest(
    observationLibrary.filter((item) => matchesItem(item, input))
  )

  const meaning = chooseBest(
    meaningLibrary.filter((item) => matchesItem(item, input))
  )

  const identityShift = chooseBest(
    identityShiftLibrary.filter((item) => matchesItem(item, input))
  )

  const nextStep = chooseBest(
    nextStepLibrary.filter((item) => matchesItem(item, input))
  )

  const beliefChallenge = input.belief
    ? chooseBest(
        beliefChallengeLibrary.filter((item) =>
          matchesItem(item, input)
        )
      )
    : undefined

  return {
    observation: observation?.text,
    meaning: meaning?.text,
    identityShift: identityShift?.text,
    beliefChallenge: beliefChallenge?.text,
    nextStep: nextStep?.text,
  }
}
