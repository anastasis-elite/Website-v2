'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { TutorialStep } from '@/lib/tutorial/types'
import { useTutorial } from '@/components/tutorial/TutorialProvider'

interface TargetRect {
  top: number
  left: number
  width: number
  height: number
}

const TARGET_LOOKUP_ATTEMPTS = 20
const TARGET_LOOKUP_INTERVAL_MS = 150
const SPOTLIGHT_PADDING = 10

function isDevelopment() {
  return process.env.NODE_ENV === 'development'
}

function getStepTargetId(step: TutorialStep) {
  if (step.kind === 'reveal') return step.revealTarget.tutorialTargetId
  if (step.kind === 'action') {
    return step.target?.tutorialTargetId ?? step.requiredAction.target?.tutorialTargetId ?? null
  }
  return step.target?.tutorialTargetId ?? null
}

function getElementRect(element: HTMLElement): TargetRect {
  const rect = element.getBoundingClientRect()
  const top = Math.max(8, rect.top - SPOTLIGHT_PADDING)
  const left = Math.max(8, rect.left - SPOTLIGHT_PADDING)
  const right = Math.min(window.innerWidth - 8, rect.right + SPOTLIGHT_PADDING)
  const bottom = Math.min(window.innerHeight - 8, rect.bottom + SPOTLIGHT_PADDING)

  return {
    top,
    left,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  }
}

function getCardPosition(rect: TargetRect | null) {
  const cardWidth = Math.min(380, Math.max(288, window.innerWidth - 32))
  const centered = {
    width: cardWidth,
    left: Math.max(16, (window.innerWidth - cardWidth) / 2),
    top: Math.max(24, (window.innerHeight - 260) / 2),
  }

  if (!rect) return centered

  const gap = 16
  const belowTop = rect.top + rect.height + gap
  const aboveTop = rect.top - 240 - gap
  const left = Math.min(
    Math.max(16, rect.left + rect.width / 2 - cardWidth / 2),
    window.innerWidth - cardWidth - 16
  )

  if (belowTop + 220 <= window.innerHeight - 16) {
    return { width: cardWidth, left, top: belowTop }
  }

  if (aboveTop >= 16) {
    return { width: cardWidth, left, top: aboveTop }
  }

  return centered
}

function StepBody({ step }: { step: TutorialStep }) {
  if (!step.description) return null

  return (
    <p style={{ margin: '10px 0 0', color: '#cdb8ad', fontSize: 14, lineHeight: 1.55 }}>
      {step.description}
    </p>
  )
}

export default function TutorialRenderer() {
  const pathname = usePathname()
  const tutorial = useTutorial()
  const {
    activeTutorial,
    activeTutorialId,
    activeProgress,
    currentStep,
    currentStepIndex,
    isCompleted,
    isHydrating,
    nextStep,
    status,
  } = tutorial
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null)
  const [targetMissing, setTargetMissing] = useState(false)
  const targetId = useMemo(
    () => (currentStep ? getStepTargetId(currentStep) : null),
    [currentStep]
  )

  const shouldRender =
    !isHydrating &&
    Boolean(activeTutorialId) &&
    Boolean(activeTutorial) &&
    Boolean(activeProgress) &&
    status === 'in_progress' &&
    !isCompleted &&
    Boolean(currentStep)

  useEffect(() => {
    if (!isDevelopment() || isHydrating) return

    console.info('[tutorial] hydration finished', {
      activeTutorialId,
      status,
      currentStepId: currentStep?.stepId ?? null,
      progressStatus: activeProgress?.status ?? null,
    })
  }, [activeProgress?.status, activeTutorialId, currentStep?.stepId, isHydrating, status])

  useEffect(() => {
    if (!isDevelopment() || !shouldRender) return

    console.info('[tutorial] renderer mounted', {
      activeTutorialId,
      currentStepId: currentStep?.stepId ?? null,
    })
  }, [activeTutorialId, currentStep?.stepId, shouldRender])

  useEffect(() => {
    setTargetElement(null)
    setTargetRect(null)
    setTargetMissing(false)

    if (!shouldRender || !targetId) return

    let attempts = 0
    let timer: number | null = null
    let cancelled = false

    const lookup = () => {
      if (cancelled) return

      const element = document.querySelector<HTMLElement>(
        `[data-tutorial-id="${CSS.escape(targetId)}"]`
      )

      if (element) {
        if (isDevelopment()) {
          console.info('[tutorial] target found', {
            targetId,
            currentStepId: currentStep?.stepId ?? null,
          })
        }
        setTargetElement(element)
        setTargetRect(getElementRect(element))
        setTargetMissing(false)
        return
      }

      attempts += 1
      if (attempts >= TARGET_LOOKUP_ATTEMPTS) {
        if (isDevelopment()) {
          console.error('[tutorial] target not found', {
            targetId,
            currentStepId: currentStep?.stepId ?? null,
            pathname,
          })
        }
        setTargetMissing(true)
        return
      }

      timer = window.setTimeout(lookup, TARGET_LOOKUP_INTERVAL_MS)
    }

    lookup()

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [currentStep?.stepId, pathname, shouldRender, targetId])

  useEffect(() => {
    if (!shouldRender || !targetElement || !targetId) return

    const updateRect = () => setTargetRect(getElementRect(targetElement))
    updateRect()

    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)

    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [shouldRender, targetElement, targetId])

  useEffect(() => {
    if (!shouldRender || !targetElement || currentStep?.kind !== 'action') return

    const advanceAfterAction = () => {
      window.setTimeout(() => {
        nextStep()
      }, 0)
    }

    targetElement.addEventListener('click', advanceAfterAction, true)

    return () => {
      targetElement.removeEventListener('click', advanceAfterAction, true)
    }
  }, [currentStep?.kind, currentStep?.stepId, nextStep, shouldRender, targetElement])

  if (!shouldRender || !currentStep || !activeTutorial) return null

  const hasTarget = Boolean(targetId)
  const canUseTarget = Boolean(targetRect && !targetMissing)
  const isInformational = currentStep.kind === 'information'
  const canAdvanceFromCard =
    isInformational || currentStep.kind === 'reveal' || (currentStep.kind === 'action' && targetMissing)
  const cardPosition =
    typeof window === 'undefined'
      ? { width: 360, left: 16, top: 120 }
      : getCardPosition(canUseTarget ? targetRect : null)

  return (
    <div
      aria-label={activeTutorial.title}
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483000,
        pointerEvents: 'none',
      }}
    >
      {canUseTarget && targetRect ? (
        <>
          <div style={scrimStyle({ top: 0, left: 0, right: 0, height: targetRect.top })} />
          <div
            style={scrimStyle({
              top: targetRect.top + targetRect.height,
              left: 0,
              right: 0,
              bottom: 0,
            })}
          />
          <div
            style={scrimStyle({
              top: targetRect.top,
              left: 0,
              width: targetRect.left,
              height: targetRect.height,
            })}
          />
          <div
            style={scrimStyle({
              top: targetRect.top,
              left: targetRect.left + targetRect.width,
              right: 0,
              height: targetRect.height,
            })}
          />
          <div
            aria-hidden="true"
            style={{
              position: 'fixed',
              top: targetRect.top,
              left: targetRect.left,
              width: targetRect.width,
              height: targetRect.height,
              border: '2px solid #f0874d',
              borderRadius: 12,
              boxShadow:
                '0 0 0 4px rgba(240, 135, 77, .22), 0 0 34px rgba(240, 135, 77, .4)',
              pointerEvents: 'none',
            }}
          />
        </>
      ) : (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, .72)',
            backdropFilter: 'blur(4px)',
            pointerEvents: 'auto',
          }}
        />
      )}

      <section
        style={{
          position: 'fixed',
          top: cardPosition.top,
          left: cardPosition.left,
          width: cardPosition.width,
          maxWidth: 'calc(100vw - 32px)',
          padding: 20,
          border: '1px solid rgba(240, 135, 77, .42)',
          borderRadius: 8,
          color: '#fff3ec',
          background: 'linear-gradient(145deg, rgba(32, 22, 18, .98), rgba(7, 7, 7, .98))',
          boxShadow: '0 28px 90px rgba(0, 0, 0, .62)',
          pointerEvents: 'auto',
        }}
      >
        <p
          style={{
            margin: '0 0 8px',
            color: '#f0874d',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
          }}
        >
          {activeTutorial.tutorialId} · Step {currentStepIndex + 1} of{' '}
          {activeTutorial.steps.length}
        </p>
        <h2 style={{ margin: 0, font: '400 22px/1.2 Georgia, serif', letterSpacing: 0 }}>
          {currentStep.title}
        </h2>
        <StepBody step={currentStep} />
        {hasTarget && targetMissing ? (
          <p
            role="status"
            style={{ margin: '12px 0 0', color: '#e7a17b', fontSize: 13, lineHeight: 1.45 }}
          >
            This step is waiting for a screen element that is not available here.
          </p>
        ) : null}
        {currentStep.kind === 'action' && !targetMissing ? (
          <p style={{ margin: '14px 0 0', color: '#f0c9b6', fontSize: 13 }}>
            Complete the highlighted action to continue.
          </p>
        ) : null}
        {canAdvanceFromCard ? (
          <button
            type="button"
            onClick={nextStep}
            style={{
              display: 'flex',
              width: '100%',
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 16,
              border: '1px solid rgba(240, 135, 77, .58)',
              borderRadius: 8,
              color: '#160b06',
              background: '#f0874d',
              font: '700 12px/1 sans-serif',
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {currentStep.kind === 'reveal' ? 'Continue' : 'Continue'}
          </button>
        ) : null}
      </section>
    </div>
  )
}

function scrimStyle(
  box: Partial<Record<'top' | 'right' | 'bottom' | 'left' | 'width' | 'height', number>>
) {
  return {
    position: 'fixed' as const,
    ...box,
    background: 'rgba(0, 0, 0, .72)',
    backdropFilter: 'blur(4px)',
    pointerEvents: 'auto' as const,
  }
}
