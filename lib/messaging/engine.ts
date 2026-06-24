import { observationLibrary } from './observations'
import { meaningLibrary } from './meanings'
import { identityShiftLibrary } from './identityShifts'
import { nextStepLibrary } from './nextSteps'
import { beliefChallengeLibrary } from './beliefChallenges'

export function generateDailyInsight() {
  const observation = observationLibrary[0]
  const meaning = meaningLibrary[0]
  const identityShift = identityShiftLibrary[0]
  const nextStep = nextStepLibrary[0]

  return {
    observation: observation.text,
    meaning: meaning.text,
    identityShift: identityShift.text,
    nextStep: nextStep.text,
  }
}
