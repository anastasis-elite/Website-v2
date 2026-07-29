import type { CapacityHistoryResult, RecoveryAction } from './types'

export function buildRecoveryActions(
  capacityHistory: CapacityHistoryResult
): RecoveryAction[] {
  if (capacityHistory.level === 'low') {
    return [
      {
        id: 'easy_walk',
        label: 'Easy walk',
        duration: { minutes: 30 },
      },
      {
        id: 'meditation',
        label: 'Meditation',
        duration: { minimumMinutes: 15, maximumMinutes: 60 },
      },
      {
        id: 'epsom_salt_soak',
        label: 'Warm Epsom salt soak',
        duration: { minimumMinutes: 20, maximumMinutes: 30 },
      },
    ]
  }

  return [
    {
      id: 'general_recovery',
      label: 'General recovery',
      duration: { minutes: 10 },
    },
  ]
}
