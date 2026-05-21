export function getCycleStatus(client: any) {
  if (!client.cycle_tracking_enabled || !client.last_period_start) {
    return {
      enabled: false,
      cycleDay: null,
      phase: null,
      label: 'Cycle tracking not active',
      recoveryCaution: false,
      recoveryNote: null,
    }
  }

  const today = new Date()
  const lastStart = new Date(client.last_period_start)

  const msPerDay = 1000 * 60 * 60 * 24
  const daysSinceStart =
    Math.floor((today.getTime() - lastStart.getTime()) / msPerDay) + 1

  const cycleLength = Number(client.average_cycle_length || 28)

  const actualDay = daysSinceStart

  let cycleDay = actualDay
  let phase = 'follicular'
  let isExtendedCycle = actualDay > cycleLength + 3
  let recoveryCaution = false
  let recoveryNote =
    'Use this only as awareness. Your actual symptoms and recovery signals matter most.'

  if (isExtendedCycle) {
  phase = 'extended_cycle'
  recoveryCaution = true
  recoveryNote =
    'Your cycle appears to be past the expected window based on your average length. Use this as awareness only. Prioritize symptoms, energy, hydration, stress, and sleep signals over the estimate.'
} else if (cycleDay <= 5) {
  phase = 'menstrual'
  recoveryCaution = true
  recoveryNote =
    'If symptoms are present, higher heat stress or aggressive recovery tools may not be the best fit today.'
} else if (cycleDay <= 13) {
  phase = 'follicular'
} else if (cycleDay <= 16) {
  phase = 'ovulatory'
} else {
  phase = 'luteal'
  recoveryCaution = true
  recoveryNote =
    'If fatigue, overheating, headaches, cramps, dizziness, or mood sensitivity are present, sauna or extra heat stress may not be recommended today.'
}

  return {
    enabled: true,
    cycleDay,
    actualDay,
    phase,
    label:
      phase === 'extended_cycle'
        ? `Day ${actualDay} since last period`
        : `Day ${cycleDay} · ${phase}`,
    recoveryCaution,
    recoveryNote,
  }
}
