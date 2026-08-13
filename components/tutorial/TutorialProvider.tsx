'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  CORE_ONBOARDING_TUTORIAL_ID,
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
  isHydrating: boolean
  persistenceError: string | null
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

async function requestTutorialProgress(
  tutorialId: TutorialId,
  init?: RequestInit
): Promise<TutorialProgress | null> {
  const url = init
    ? '/api/tutorial-progress'
    : `/api/tutorial-progress?tutorialId=${encodeURIComponent(tutorialId)}`
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: {
      ...(init?.headers ?? {}),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'Tutorial progress request failed.')
  }

  const body = (await response.json()) as { progress: TutorialProgress | null }
  return body.progress
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [activeTutorialId, setActiveTutorialId] = useState<TutorialId | null>(null)
  const [progressByTutorialId, setProgressByTutorialId] = useState<
    Record<TutorialId, TutorialProgress>
  >({})
  const [isHydrating, setIsHydrating] = useState(true)
  const [persistenceError, setPersistenceError] = useState<string | null>(null)

  const applyProgress = useCallback((progress: TutorialProgress) => {
    setProgressByTutorialId((current) => ({
      ...current,
      [progress.tutorialId]: progress,
    }))

    setActiveTutorialId((currentActiveTutorialId) => {
      if (progress.status === 'in_progress') return progress.tutorialId
      if (currentActiveTutorialId === progress.tutorialId) return null
      return currentActiveTutorialId
    })
  }, [])

  const persistProgress = useCallback(
    async (
      tutorialId: TutorialId,
      body: {
        action: 'start' | 'step' | 'complete' | 'reset'
        currentStepId?: TutorialStepId | null
      }
    ) => {
      const progress = await requestTutorialProgress(tutorialId, {
        method: 'POST',
        body: JSON.stringify({ tutorialId, ...body }),
      })

      if (progress) applyProgress(progress)
      return progress
    },
    [applyProgress]
  )

  useEffect(() => {
    let isMounted = true

    async function hydrateTutorialProgress() {
      try {
        const progress = await requestTutorialProgress(CORE_ONBOARDING_TUTORIAL_ID)
        if (!isMounted) return

        setPersistenceError(null)
        setProgressByTutorialId((current) => ({
          ...current,
          [CORE_ONBOARDING_TUTORIAL_ID]:
            progress ?? createNotStartedProgress(CORE_ONBOARDING_TUTORIAL_ID),
        }))
        setActiveTutorialId(
          progress?.status === 'in_progress' ? progress.tutorialId : null
        )
      } catch (error) {
        if (!isMounted) return
        console.error('TUTORIAL PROGRESS HYDRATION ERROR:', error)
        setPersistenceError(
          error instanceof Error
            ? error.message
            : 'Unable to load tutorial progress.'
        )
      } finally {
        if (isMounted) setIsHydrating(false)
      }
    }

    hydrateTutorialProgress()

    return () => {
      isMounted = false
    }
  }, [])

  const startTutorial = useCallback((tutorialId: TutorialId) => {
    const tutorial = requireTutorial(tutorialId)

    if (isHydrating) return
    if (progressByTutorialId[tutorialId]?.status === 'completed') return

    persistProgress(tutorialId, {
      action: 'start',
      currentStepId: getInitialStepId(tutorial),
    }).catch((error) => {
      console.error('TUTORIAL START ERROR:', error)
      setPersistenceError(
        error instanceof Error ? error.message : 'Unable to start tutorial.'
      )
    })
  }, [isHydrating, persistProgress, progressByTutorialId])

  const completeTutorial = useCallback((tutorialId?: TutorialId) => {
    const targetTutorialId = tutorialId ?? activeTutorialId
    if (!targetTutorialId) return
    const tutorial = requireTutorial(targetTutorialId)

    persistProgress(targetTutorialId, {
      action: 'complete',
      currentStepId:
        progressByTutorialId[targetTutorialId]?.currentStepId ??
        tutorial.steps[tutorial.steps.length - 1]?.stepId ??
        null,
    }).catch((error) => {
      console.error('TUTORIAL COMPLETE ERROR:', error)
      setPersistenceError(
        error instanceof Error ? error.message : 'Unable to complete tutorial.'
      )
    })
  }, [activeTutorialId, persistProgress, progressByTutorialId])

  const resetTutorial = useCallback((tutorialId?: TutorialId) => {
    if (process.env.NODE_ENV !== 'development') return

    const targetTutorialId = tutorialId ?? activeTutorialId
    if (!targetTutorialId) return
    requireTutorial(targetTutorialId)

    persistProgress(targetTutorialId, { action: 'reset' }).catch((error) => {
      console.error('TUTORIAL RESET ERROR:', error)
      setPersistenceError(
        error instanceof Error ? error.message : 'Unable to reset tutorial.'
      )
    })
  }, [activeTutorialId, persistProgress])

  const goToStep = useCallback((stepId: TutorialStepId) => {
    if (!activeTutorialId) return

    const tutorial = requireTutorial(activeTutorialId)
    if (!tutorial.steps.some((step) => step.stepId === stepId)) {
      throw new Error(
        `Step "${stepId}" is not registered for tutorial "${activeTutorialId}".`
      )
    }

    persistProgress(activeTutorialId, {
      action: 'step',
      currentStepId: stepId,
    }).catch((error) => {
      console.error('TUTORIAL STEP ERROR:', error)
      setPersistenceError(
        error instanceof Error ? error.message : 'Unable to save tutorial step.'
      )
    })
  }, [activeTutorialId, persistProgress])

  const nextStep = useCallback(() => {
    if (!activeTutorialId) return

    const tutorial = requireTutorial(activeTutorialId)
    const existing =
      progressByTutorialId[activeTutorialId] ?? createNotStartedProgress(activeTutorialId)

    if (existing.status === 'completed') return

    const currentIndex = tutorial.steps.findIndex(
      (step) => step.stepId === existing.currentStepId
    )
    const nextIndex = currentIndex < 0 ? 0 : currentIndex + 1
    const nextStepId = tutorial.steps[nextIndex]?.stepId

    const action = nextStepId ? 'step' : 'complete'
    persistProgress(activeTutorialId, {
      action,
      currentStepId: nextStepId ?? existing.currentStepId,
    }).catch((error) => {
      console.error('TUTORIAL NEXT STEP ERROR:', error)
      setPersistenceError(
        error instanceof Error ? error.message : 'Unable to save tutorial progress.'
      )
    })
  }, [activeTutorialId, persistProgress, progressByTutorialId])

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
      isHydrating,
      persistenceError,
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
    isHydrating,
    nextStep,
    persistenceError,
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
