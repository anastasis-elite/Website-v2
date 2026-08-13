'use client'

import { CORE_ONBOARDING_TUTORIAL_ID } from '@/lib/tutorial/registry'
import { useTutorial } from '@/components/tutorial/TutorialProvider'

export default function TutorialDevPanel() {
  const tutorial = useTutorial()

  if (process.env.NODE_ENV !== 'development') return null

  return (
    <aside
      aria-label="Tutorial development controls"
      style={{
        position: 'fixed',
        right: 12,
        bottom: 92,
        zIndex: 80,
        display: 'grid',
        width: 220,
        gap: 8,
        padding: 12,
        border: '1px solid rgba(255,255,255,.16)',
        borderRadius: 8,
        color: '#f7efe8',
        background: 'rgba(7,7,7,.9)',
        boxShadow: '0 18px 42px rgba(0,0,0,.35)',
        fontSize: 12,
      }}
    >
      <strong style={{ fontSize: 12 }}>Tutorial Dev</strong>
      <div style={{ display: 'grid', gap: 2, color: '#c9b7ab' }}>
        <span>ID: {tutorial.activeTutorialId ?? 'none'}</span>
        <span>Status: {tutorial.status}</span>
        <span>Hydrating: {tutorial.isHydrating ? 'yes' : 'no'}</span>
        <span>
          Step:{' '}
          {tutorial.currentStep
            ? `${tutorial.currentStepIndex + 1}. ${tutorial.currentStep.stepId}`
            : 'none'}
        </span>
        {tutorial.persistenceError && <span>Error: {tutorial.persistenceError}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <button type="button" onClick={() => tutorial.startTutorial(CORE_ONBOARDING_TUTORIAL_ID)}>
          Start
        </button>
        <button type="button" onClick={tutorial.nextStep}>
          Next
        </button>
        <button type="button" onClick={() => tutorial.completeTutorial()}>
          Complete
        </button>
        <button type="button" onClick={() => tutorial.resetTutorial()}>
          Reset
        </button>
      </div>
    </aside>
  )
}
