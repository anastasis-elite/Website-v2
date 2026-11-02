export const practices = {
  'breath-reset': {
    title: 'Breath Reset',
    copy: 'Seven gentle rounds to slow the pace and return to the next clear step.',
    icon: '❀',
  },
  'calm-reset': {
    title: 'Calm Reset',
    copy: 'A gentle reset for a crowded day.',
    icon: '≋',
  },
  'sleep-wind-down': {
    title: 'Sleep Wind Down',
    copy: 'Lower the pace and prepare for sleep.',
    icon: '☾',
  },
  'recovery-meditation': {
    title: 'Recovery Meditation',
    copy: 'Make space for recovery without another task.',
    icon: '♧',
  },
} as const

export type PracticeId = keyof typeof practices
export type PracticePhase = 'Inhale' | 'Exhale' | 'Hold'

export type TimedPracticePhase = {
  phase: PracticePhase
  durationMs: number
  startMs: number
  endMs: number
  round: number
}

export type PracticeTimeline = {
  phases: TimedPracticePhase[]
  durationMs: number
  rounds: number | null
}

const breathResetRounds = [
  [4000, 6000, 1000],
  [4500, 7000, 1000],
  [5000, 8000, 2000],
  [5500, 9000, 2000],
  [6000, 10000, 2000],
  [6500, 11000, 2000],
  [7000, 12000, 3000],
] as const

export function createPracticeTimeline(practice: PracticeId, skipHolds = false): PracticeTimeline {
  const phases: TimedPracticePhase[] = []
  let durationMs = 0
  const append = (phase: PracticePhase, phaseDurationMs: number, round: number) => {
    phases.push({ phase, durationMs: phaseDurationMs, startMs: durationMs, endMs: durationMs + phaseDurationMs, round })
    durationMs += phaseDurationMs
  }

  if (practice === 'breath-reset' || practice === 'sleep-wind-down') {
    const rounds = practice === 'breath-reset'
      ? breathResetRounds
      : Array.from({ length: 36 }, (_, index) => [4000 + 100 * index, 6000 + 200 * index, index < 15 ? 1000 : 2000] as const)
    rounds.forEach(([inhaleMs, exhaleMs, holdMs], index) => {
      append('Inhale', inhaleMs, index + 1)
      append('Exhale', exhaleMs, index + 1)
      if (!skipHolds) append('Hold', holdMs, index + 1)
    })
    return { phases, durationMs, rounds: rounds.length }
  }

  // These existing practices keep their original four-second alternating rhythm.
  const fixedDurationMs = practice === 'calm-reset' ? 300000 : 480000
  for (let index = 0; durationMs < fixedDurationMs; index++) {
    append(index % 2 === 0 ? 'Inhale' : 'Exhale', Math.min(4000, fixedDurationMs - durationMs), Math.floor(index / 2) + 1)
  }
  return { phases, durationMs, rounds: null }
}

export function getPracticeFrame(timeline: PracticeTimeline, elapsedMs: number) {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, Math.min(elapsedMs, timeline.durationMs)) : 0
  const finished = elapsed >= timeline.durationMs
  // End boundaries belong to the next phase, including the hold after the final exhale.
  const current = timeline.phases.find(phase => elapsed < phase.endMs) ?? timeline.phases[timeline.phases.length - 1]
  const phaseProgress = Math.min(1, Math.max(0, (elapsed - current.startMs) / current.durationMs))
  const orbScale = finished || current.phase === 'Hold'
    ? 0.82
    : current.phase === 'Inhale' ? 0.82 + 0.18 * phaseProgress : 1 - 0.18 * phaseProgress

  return {
    phase: current.phase,
    phaseRemainingMs: Math.max(0, current.endMs - elapsed),
    phaseProgress,
    orbScale,
    round: current.round,
    finished,
  }
}
