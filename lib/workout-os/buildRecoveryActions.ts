import type {
  FuelStatus,
  RecoveryStatus,
} from '@/lib/dashboard/logic/types'

import type {
  RecoveryAction,
  SorenessRegionKey,
} from './types'

type BuildRecoveryActionsInput = {
  targetCount: number
  recoveryStatus: RecoveryStatus
  fuelStatus: FuelStatus
  hydrationPercent: number
  sorenessRegions: SorenessRegionKey[]
}

const GENERAL_RECOVERY: RecoveryAction = {
  id: 'general_recovery',
  label: 'Intentional recovery',
  duration: {
    minutes: 10,
  },
}

const EASY_WALK: RecoveryAction = {
  id: 'easy_walk',
  label: 'Easy walk',
  duration: {
    minutes: 30,
  },
}

const MEDITATION: RecoveryAction = {
  id: 'meditation',
  label: 'Meditation',
  duration: {
    minimumMinutes: 15,
    maximumMinutes: 60,
  },
}

const EPSOM_SALT_SOAK: RecoveryAction = {
  id: 'epsom_salt_soak',
  label: 'Warm Epsom salt soak',
  duration: {
    minimumMinutes: 20,
    maximumMinutes: 30,
  },
}

const HYDRATION_ACTION: RecoveryAction = {
  id: 'hydration_support',
  label: 'Complete remaining hydration target',
  duration: {
    minutes: 10,
  },
}

const FUELING_ACTION: RecoveryAction = {
  id: 'fueling_support',
  label: 'Complete a protein and carbohydrate recovery meal',
  duration: {
    minutes: 20,
  },
}

const MOBILITY_ACTION: RecoveryAction = {
  id: 'gentle_mobility',
  label: 'Gentle mobility for sore areas',
  duration: {
    minimumMinutes: 10,
    maximumMinutes: 15,
  },
}

function addUniqueAction(
  actions: RecoveryAction[],
  action: RecoveryAction,
): void {
  const alreadyIncluded = actions.some(
    (existingAction) =>
      existingAction.id === action.id,
  )

  if (!alreadyIncluded) {
    actions.push(action)
  }
}

export function buildRecoveryActions({
  targetCount,
  recoveryStatus,
  fuelStatus,
  hydrationPercent,
  sorenessRegions,
}: BuildRecoveryActionsInput): RecoveryAction[] {
  const actions: RecoveryAction[] = []

  if (hydrationPercent < 80) {
    addUniqueAction(
      actions,
      HYDRATION_ACTION,
    )
  }

  if (
    fuelStatus === 'under_fueled' ||
    fuelStatus === 'depleted' ||
    fuelStatus ===
      'slightly_under_fueled'
  ) {
    addUniqueAction(
      actions,
      FUELING_ACTION,
    )
  }

  if (sorenessRegions.length > 0) {
    addUniqueAction(
      actions,
      MOBILITY_ACTION,
    )
  }

  if (
    recoveryStatus === 'active_recovery' ||
    recoveryStatus ===
      'full_recovery_or_red_flag'
  ) {
    addUniqueAction(actions, EASY_WALK)
    addUniqueAction(actions, MEDITATION)
    addUniqueAction(
      actions,
      EPSOM_SALT_SOAK,
    )
  }

  const defaultActions = [
    GENERAL_RECOVERY,
    EASY_WALK,
    MEDITATION,
    EPSOM_SALT_SOAK,
  ]

  for (const action of defaultActions) {
    if (actions.length >= targetCount) {
      break
    }

    addUniqueAction(actions, action)
  }

  return actions.slice(
    0,
    Math.max(0, targetCount),
  )
}
