'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  getTutorialDefinition,
  hasTutorialDefinition,
} from '@/lib/tutorial/registry'
import type {
  TutorialDefinition,
  TutorialId,
  TutorialProgress,
  TutorialStep,
  TutorialStepId,
  TutorialStatus,
} from '@/lib/tutorial/types'

interface TutorialContextValue {
  activeTutorialId: TutorialId | null
  activeTutorial: TutorialDefinition | null
  activeProgress: TutorialProgress | null
  currentStep: TutorialStep | null
  currentStepIndex: number
  status: TutorialStatus
  hasStarted: boolean
  isCompleted: boolean
  startTutorial: (tutorialId: TutorialId) => void
  nextStep: () => void
  goToStep: (stepId: TutorialStepId) => void
  completeTutorial: (tutorialId?: TutorialId) => void
  resetTutorial: (tutorialId?: TutorialId) => void
}

const TutorialContext = createContext<TutorialContextValue | null>(null)

function nowIso() {
  return new Date().toISOString()
}

function createNotStartedProgress(tutorialId: TutorialId): TutorialProgress {
  return {
    tutorialId,
    status: 'not_started',
    currentStepId: null,
    startedAt: null,
    completedAt: null,
    updatedAt: nowIso(),
  }
}

function getInitialStepId(tutorial: TutorialDefinition) {
  return tutorial.steps[0]?.stepId ?? null
}

function requireTutorial(tutorialId: TutorialId) {
  const tutorial = getTutorialDefinition(tutorialId)
  if (!tutorial) {
    throw new Error(`Tutorial "${tutorialId}" is not registered.`)
  }
  return tutorial
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [activeTutorialId, setActiveTutorialId] = useState<TutorialId | null>(null)
  const [progressByTutorialId, setProgressByTutorialId] = useState<
    Record<TutorialId, TutorialProgress>
  >({})

  const startTutorial = useCallback((tutorialId: TutorialId) => {
    const tutorial = requireTutorial(tutorialId)

    setActiveTutorialId(tutorialId)
    setProgressByTutorialId((current) => {
      const existing = current[tutorialId]
      if (existing?.status === 'completed') return current

      const timestamp = nowIso()
      return {
        ...current,
        [tutorialId]: {
          tutorialId,
          status: 'in_progress',
          currentStepId: existing?.currentStepId ?? getInitialStepId(tutorial),
          startedAt: existing?.startedAt ?? timestamp,
          completedAt: null,
          updatedAt: timestamp,
        },
      }
    })
  }, [])

  const completeTutorial = useCallback((tutorialId?: TutorialId) => {
    const targetTutorialId = tutorialId ?? activeTutorialId
    if (!targetTutorialId) return
    requireTutorial(targetTutorialId)

    setActiveTutorialId(targetTutorialId)
    setProgressByTutorialId((current) => {
      const timestamp = nowIso()
      const existing =
        current[targetTutorialId] ?? createNotStartedProgress(targetTutorialId)

      return {
        ...current,
        [targetTutorialId]: {
          ...existing,
          status: 'completed',
          completedAt: existing.completedAt ?? timestamp,
          updatedAt: timestamp,
        },
      }
    })
  }, [activeTutorialId])

  const resetTutorial = useCallback((tutorialId?: TutorialId) => {
    const targetTutorialId = tutorialId ?? activeTutorialId
    if (!targetTutorialId) return
    requireTutorial(targetTutorialId)

    setActiveTutorialId(targetTutorialId)
    setProgressByTutorialId((current) => ({
      ...current,
      [targetTutorialId]: createNotStartedProgress(targetTutorialId),
    }))
  }, [activeTutorialId])

  const goToStep = useCallback((stepId: TutorialStepId) => {
    setProgressByTutorialId((current) => {
      if (!activeTutorialId) return current

      const tutorial = requireTutorial(activeTutorialId)
      if (!tutorial.steps.some((step) => step.stepId === stepId)) {
        throw new Error(
          `Step "${stepId}" is not registered for tutorial "${activeTutorialId}".`
        )
      }

      const existing =
        current[activeTutorialId] ?? createNotStartedProgress(activeTutorialId)
      const timestamp = nowIso()

      return {
        ...current,
        [activeTutorialId]: {
          ...existing,
          status: 'in_progress',
          currentStepId: stepId,
          startedAt: existing.startedAt ?? timestamp,
          completedAt: null,
          updatedAt: timestamp,
        },
      }
    })
  }, [activeTutorialId])

  const nextStep = useCallback(() => {
    setProgressByTutorialId((current) => {
      if (!activeTutorialId) return current

      const tutorial = requireTutorial(activeTutorialId)
      const existing =
        current[activeTutorialId] ?? createNotStartedProgress(activeTutorialId)

      if (existing.status === 'completed') return current

      const currentIndex = tutorial.steps.findIndex(
        (step) => step.stepId === existing.currentStepId
      )
      const nextIndex = currentIndex < 0 ? 0 : currentIndex + 1
      const nextStepId = tutorial.steps[nextIndex]?.stepId

      if (!nextStepId) {
        const timestamp = nowIso()
        return {
          ...current,
          [activeTutorialId]: {
            ...existing,
            status: 'completed',
            completedAt: existing.completedAt ?? timestamp,
            updatedAt: timestamp,
          },
        }
      }

      const timestamp = nowIso()
      return {
        ...current,
        [activeTutorialId]: {
          ...existing,
          status: 'in_progress',
          currentStepId: nextStepId,
          startedAt: existing.startedAt ?? timestamp,
          completedAt: null,
          updatedAt: timestamp,
        },
      }
    })
  }, [activeTutorialId])

  const value = useMemo<TutorialContextValue>(() => {
    const activeTutorial =
      activeTutorialId && hasTutorialDefinition(activeTutorialId)
        ? getTutorialDefinition(activeTutorialId)
        : null
    const activeProgress = activeTutorialId
      ? progressByTutorialId[activeTutorialId] ?? null
      : null
    const currentStepIndex =
      activeTutorial && activeProgress?.currentStepId
        ? activeTutorial.steps.findIndex(
            (step) => step.stepId === activeProgress.currentStepId
          )
        : -1
    const currentStep =
      currentStepIndex >= 0 ? activeTutorial?.steps[currentStepIndex] ?? null : null
    const status = activeProgress?.status ?? 'not_started'

    return {
      activeTutorialId,
      activeTutorial,
      activeProgress,
      currentStep,
      currentStepIndex,
      status,
      hasStarted: status !== 'not_started',
      isCompleted: status === 'completed',
      startTutorial,
      nextStep,
      goToStep,
      completeTutorial,
      resetTutorial,
    }
  }, [
    activeTutorialId,
    completeTutorial,
    goToStep,
    nextStep,
    progressByTutorialId,
    resetTutorial,
    startTutorial,
  ])

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  )
}

export function useTutorial() {
  const context = useContext(TutorialContext)
  if (!context) {
    throw new Error('useTutorial must be used within TutorialProvider.')
  }
  return context
}
