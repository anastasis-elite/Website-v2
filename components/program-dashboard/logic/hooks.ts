'use client'

import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'

export function useProgramLogicEngine(data: ProgramLogicOutput) { return data }
export function useClientDashboardData(data: ProgramLogicOutput) { return data.client }
export function useCapacityEngine(data: ProgramLogicOutput) { return data.capacityStatus }
export function useRecoveryEngine(data: ProgramLogicOutput) { return data.recoveryStatus }
export function useFuelReadinessEngine(data: ProgramLogicOutput) { return data.fuelReadiness }
export function useWorkoutDecisionEngine(data: ProgramLogicOutput) { return data.workoutDecision }
export function useNutritionEngine(data: ProgramLogicOutput) { return data.nutrition }
export function useHydrationEngine(data: ProgramLogicOutput) { return data.hydration }
export function useCycleEngine(data: ProgramLogicOutput) { return data.cycle }
export function useSymptomEngine(data: ProgramLogicOutput) { return data.symptoms }
export function usePostureCompensationEngine(data: ProgramLogicOutput) { return data.posture }
export function useFlameExecutionEngine(data: ProgramLogicOutput) { return data.flameState }
export function useAssessmentStatus(data: ProgramLogicOutput) { return data.assessments }
export function useMonthlyAssessmentDue(data: ProgramLogicOutput) { return data.assessments.monthlyDueCount > 0 }
export function useDailyCheckInStatus(data: ProgramLogicOutput) { return data.assessments.dailyCompleted }
export function useRecoveryStatus(data: ProgramLogicOutput) { return data.recoveryCheck }
export function useSleepStatus(data: ProgramLogicOutput) { return data.sleep }
