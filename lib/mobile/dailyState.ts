import type {
  DayBlock,
  ProgramLogicOutput,
  ProgramTier,
  StreakItem,
} from '@/lib/dashboard/logic/types'

type ActionId = 'water' | 'nutrition' | 'check-in' | 'workout' | 'recovery'
type ActionStatus = 'complete' | 'urgent' | 'active' | 'upcoming'
type ActionKind = 'quick' | 'route'

export type MobileDailyAction = {
  id: ActionId
  label: string
  status: ActionStatus
  progress: number
  detail: string
  href: string
  kind: ActionKind
  required: boolean
  primary?: boolean
}

export type MobileDailyState = {
  engineVersion: string
  generatedAt: string
  user: {
    id: string
    clientId: string
    name: string
    program: ProgramTier
    goal: string | null
  }
  currentBlock: DayBlock
  summary: {
    title: string
    body: string
    adjusted: boolean
    adjustmentReason: string | null
    alert: string | null
  }
  capacity: ProgramLogicOutput['capacityStatus']
  recovery: ProgramLogicOutput['recoveryStatus']
  hydration: ProgramLogicOutput['hydration']
  nutrition: {
    status: ProgramLogicOutput['nutrition']['dataStatus']
    calories: ProgramLogicOutput['nutrition']['calories']
    protein: ProgramLogicOutput['nutrition']['protein']
    carbs: ProgramLogicOutput['nutrition']['carbs']
    fats: ProgramLogicOutput['nutrition']['fats']
    remainingTargets: {
      calories: number
      protein: number
      carbs: number
      fats: number
      water: number
    }
    suggestions: string[]
    preWorkoutFuelPrompt: string
  }
  workout: ProgramLogicOutput['workout'] & {
    canTrain: boolean
    adjustmentLevel: ProgramLogicOutput['workoutDecision']['adjustmentLevel']
    intensityTarget: string
  }
  dailyCheckIn: ProgramLogicOutput['assessments']
  recoveryAction: {
    completed: boolean
    target: number
    actions: ProgramLogicOutput['recoveryActions']
  }
  execution: {
    score: number
    streak: number
    streakEligible: boolean
    completedActions: MobileDailyAction[]
    adjustedActions: string[]
  }
  priorities: string[]
  nextAction: MobileDailyAction
  actions: MobileDailyAction[]
  dayComplete: boolean
  closure: {
    title: string
    body: string
    next: string | null
  } | null
  alerts: string[]
  presentation: ProgramLogicOutput['presentation']
}

const actionToRequirement: Record<ActionId, StreakItem> = {
  water: 'hydration',
  nutrition: 'nutrition',
  'check-in': 'dailyCheckIn',
  workout: 'workoutOrMovement',
  recovery: 'recovery',
}

function progressStatus(progress: number, required: boolean): ActionStatus {
  if (progress >= 100) return 'complete'
  if (required && progress <= 10) return 'urgent'
  return progress > 0 ? 'active' : 'upcoming'
}

function action({
  id,
  label,
  progress,
  detail,
  href,
  kind,
  logic,
}: {
  id: ActionId
  label: string
  progress: number
  detail: string
  href: string
  kind: ActionKind
  logic: ProgramLogicOutput
}): MobileDailyAction {
  const requirement = actionToRequirement[id]
  const required = Boolean(logic.flameState.requirements.requiredItems[requirement])
  return {
    id,
    label,
    status: progressStatus(progress, required),
    progress: Math.max(0, Math.min(100, Math.round(progress))),
    detail,
    href,
    kind,
    required,
  }
}

function buildActions(logic: ProgramLogicOutput): MobileDailyAction[] {
  const actions = [
    action({
      id: 'check-in',
      label: 'Check-In',
      progress: logic.assessments.dailyCompleted ? 100 : 0,
      detail: logic.assessments.dailyCompleted
        ? 'Body signals logged'
        : 'Sleep, energy, stress, soreness',
      href: '/check-in',
      kind: 'route',
      logic,
    }),
    action({
      id: 'water',
      label: 'Water',
      progress: logic.hydration.percent,
      detail: `${logic.hydration.consumed}/${logic.hydration.target} oz`,
      href: '/nutrition',
      kind: 'quick',
      logic,
    }),
    action({
      id: 'nutrition',
      label: 'Nutrition',
      progress: Math.round(
        (logic.nutrition.calories.percent +
          logic.nutrition.protein.percent +
          logic.nutrition.carbs.percent +
          logic.nutrition.fats.percent) /
          4,
      ),
      detail:
        logic.nutrition.dataStatus === 'known'
          ? `${logic.nutrition.protein.remaining}g protein left`
          : 'Log the next meal',
      href: '/food-log',
      kind: 'route',
      logic,
    }),
    action({
      id: 'workout',
      label: logic.workout.assigned ? 'Workout' : 'Movement',
      progress: logic.workout.completed ? 100 : 0,
      detail: logic.workout.completed
        ? 'Completed'
        : logic.workout.title,
      href: '/workout',
      kind: 'route',
      logic,
    }),
    action({
      id: 'recovery',
      label: 'Recovery',
      progress: logic.recoveryCheck.completed ? 100 : 0,
      detail: logic.recoveryCheck.completed
        ? 'Recovery action logged'
        : logic.recoveryActions[0]?.label || 'Complete recovery action',
      href: '/recovery',
      kind: 'quick',
      logic,
    }),
  ]

  return actions
}

function buildPriorities(
  logic: ProgramLogicOutput,
  actions: MobileDailyAction[],
) {
  const priorities: string[] = []

  if (logic.symptoms.redFlag || logic.recoveryStatus.redFlags.length) {
    priorities.push('Safety signal')
  }

  if (!logic.assessments.dailyCompleted) {
    priorities.push('Daily check-in')
  }

  if (logic.hydration.percent < 70) {
    priorities.push('Hydration')
  }

  if (
    logic.fuelReadiness.displayStatus === 'Needs Fuel' ||
    logic.fuelReadiness.displayStatus === 'Depleted'
  ) {
    priorities.push('Fueling')
  }

  if (!logic.workout.completed && logic.workoutDecision.displayWorkout) {
    priorities.push(logic.workout.assigned ? 'Workout' : 'Movement')
  }

  if (
    logic.flameState.requirements.requiredItems.recovery &&
    !logic.recoveryCheck.completed
  ) {
    priorities.push('Recovery')
  }

  if (!priorities.length) {
    priorities.push(...actions.filter((item) => item.status !== 'complete').map((item) => item.label))
  }

  return Array.from(new Set(priorities)).slice(0, logic.presentation.maxTasksPerBlock)
}

function chooseNextAction(
  logic: ProgramLogicOutput,
  actions: MobileDailyAction[],
) {
  const incomplete = actions.filter((item) => item.status !== 'complete')

  if (!incomplete.length) return actions[0]

  const order: ActionId[] = logic.capacityStatus.status === 'low_capacity'
    ? ['check-in', 'water', 'recovery', 'nutrition', 'workout']
    : logic.fuelReadiness.currentBlock === 'morning'
      ? ['check-in', 'water', 'nutrition', 'workout', 'recovery']
      : logic.fuelReadiness.currentBlock === 'midday'
        ? ['nutrition', 'water', 'workout', 'check-in', 'recovery']
        : ['nutrition', 'water', 'recovery', 'check-in', 'workout']

  if (
    logic.fuelReadiness.displayStatus === 'Needs Fuel' ||
    logic.fuelReadiness.displayStatus === 'Depleted'
  ) {
    order.unshift('nutrition')
  }

  if (logic.hydration.percent < 35) {
    order.unshift('water')
  }

  if (!logic.assessments.dailyCompleted) {
    order.unshift('check-in')
  }

  const next = order
    .map((id) => incomplete.find((item) => item.id === id))
    .find(Boolean)

  return next || incomplete[0]
}

function summaryTitle(logic: ProgramLogicOutput, dayComplete: boolean) {
  if (dayComplete) return 'Day complete'
  if (logic.symptoms.redFlag) return 'Safety comes first today'
  if (logic.workoutDecision.adjustmentLevel !== 'level_0_full_plan') {
    return logic.recoveryStatus.status === 'modify_workout' ||
      logic.recoveryStatus.status === 'active_recovery'
      ? 'Training is adjusted today'
      : 'Your plan has been adjusted'
  }
  if (logic.flameState.requirements.completionScore >= 75) {
    return 'You are on track'
  }
  return logic.flameState.completionMessage
}

export function buildMobileDailyState(
  logic: ProgramLogicOutput,
): MobileDailyState {
  const actions = buildActions(logic)
  const dayComplete = logic.flameState.streakEligible
  const nextAction = chooseNextAction(logic, actions)
  nextAction.primary = true
  const adjusted = logic.workoutDecision.adjustmentLevel !== 'level_0_full_plan'
  const adjustedActions = adjusted
    ? [
        logic.workoutDecision.reasonForModification,
        ...logic.workoutDecision.modifications,
      ].filter(Boolean)
    : []
  const alerts = [
    logic.symptoms.redFlag ? logic.symptoms.recoveryRecommendation : null,
    ...logic.recoveryStatus.redFlags.map((flag) => `Recovery flag: ${flag}`),
  ].filter(Boolean) as string[]

  return {
    engineVersion: logic.engineVersion,
    generatedAt: logic.generatedAt,
    user: {
      id: logic.client.id,
      clientId: logic.client.id,
      name: logic.client.name,
      program: logic.program,
      goal: logic.client.goal,
    },
    currentBlock: logic.fuelReadiness.currentBlock,
    summary: {
      title: summaryTitle(logic, dayComplete),
      body: dayComplete
        ? logic.flameState.completionMessage
        : logic.insight.concise,
      adjusted,
      adjustmentReason: adjusted ? logic.workoutDecision.reasonForModification : null,
      alert: alerts[0] || null,
    },
    capacity: logic.capacityStatus,
    recovery: logic.recoveryStatus,
    hydration: logic.hydration,
    nutrition: {
      status: logic.nutrition.dataStatus,
      calories: logic.nutrition.calories,
      protein: logic.nutrition.protein,
      carbs: logic.nutrition.carbs,
      fats: logic.nutrition.fats,
      remainingTargets: {
        calories: logic.nutrition.calories.remaining,
        protein: logic.nutrition.protein.remaining,
        carbs: logic.nutrition.carbs.remaining,
        fats: logic.nutrition.fats.remaining,
        water: logic.hydration.remaining,
      },
      suggestions: logic.nutrition.mealSuggestions,
      preWorkoutFuelPrompt: logic.nutrition.preWorkoutFuelPrompt,
    },
    workout: {
      ...logic.workout,
      canTrain: logic.workoutDecision.canTrain,
      adjustmentLevel: logic.workoutDecision.adjustmentLevel,
      intensityTarget: logic.workoutDecision.intensityTarget,
    },
    dailyCheckIn: logic.assessments,
    recoveryAction: {
      completed: logic.recoveryCheck.completed,
      target: logic.recoveryTarget,
      actions: logic.recoveryActions,
    },
    execution: {
      score: logic.flameState.requirements.completionScore,
      streak: logic.flameState.streak,
      streakEligible: logic.flameState.streakEligible,
      completedActions: actions.filter((item) => item.status === 'complete'),
      adjustedActions: adjustedActions.slice(0, 3),
    },
    priorities: buildPriorities(logic, actions),
    nextAction,
    actions,
    dayComplete,
    closure: dayComplete
      ? {
          title: 'Today is closed',
          body: logic.insight.concise,
          next: logic.recoveryActions[0]?.label || null,
        }
      : null,
    alerts,
    presentation: logic.presentation,
  }
}
