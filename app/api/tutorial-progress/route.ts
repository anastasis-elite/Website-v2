import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  completeTutorialProgress,
  getTutorialProgress,
  resetTutorialProgress,
  startTutorialProgress,
  updateTutorialStep,
} from '@/lib/tutorial/progress'
import { getTutorialDefinition } from '@/lib/tutorial/registry'
import type { TutorialId, TutorialStepId } from '@/lib/tutorial/types'

type TutorialProgressAction = 'start' | 'step' | 'complete' | 'reset'

interface TutorialProgressRequestBody {
  action?: TutorialProgressAction
  tutorialId?: TutorialId
  currentStepId?: TutorialStepId | null
}

function getFirstStepId(tutorialId: TutorialId) {
  return getTutorialDefinition(tutorialId)?.steps[0]?.stepId ?? null
}

function getFinalStepId(tutorialId: TutorialId) {
  const steps = getTutorialDefinition(tutorialId)?.steps ?? []
  return steps[steps.length - 1]?.stepId ?? null
}

function isRegisteredStep(tutorialId: TutorialId, stepId: TutorialStepId) {
  return (
    getTutorialDefinition(tutorialId)?.steps.some((step) => step.stepId === stepId) ??
    false
  )
}

export async function GET(request: Request) {
  const tutorialId = new URL(request.url).searchParams.get('tutorialId')
  if (!tutorialId || !getTutorialDefinition(tutorialId)) {
    return NextResponse.json({ error: 'Unknown tutorial.' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) throw userError
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const progress = await getTutorialProgress(supabase, user.id, tutorialId)
    return NextResponse.json({ progress })
  } catch (error) {
    console.error('TUTORIAL PROGRESS READ ERROR:', error)
    return NextResponse.json(
      { error: 'Unable to load tutorial progress.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  let body: TutorialProgressRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid tutorial request.' }, { status: 400 })
  }

  const { action, tutorialId, currentStepId } = body
  if (!action || !tutorialId || !getTutorialDefinition(tutorialId)) {
    return NextResponse.json({ error: 'Invalid tutorial request.' }, { status: 400 })
  }

  if (action === 'step' && (!currentStepId || !isRegisteredStep(tutorialId, currentStepId))) {
    return NextResponse.json({ error: 'Unknown tutorial step.' }, { status: 400 })
  }

  if (
    action === 'complete' &&
    currentStepId &&
    !isRegisteredStep(tutorialId, currentStepId)
  ) {
    return NextResponse.json({ error: 'Unknown tutorial step.' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) throw userError
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let progress
    if (action === 'start') {
      progress = await startTutorialProgress(
        supabase,
        user.id,
        tutorialId,
        getFirstStepId(tutorialId)
      )
    } else if (action === 'step') {
      if (!currentStepId) {
        return NextResponse.json({ error: 'Unknown tutorial step.' }, { status: 400 })
      }
      progress = await updateTutorialStep(
        supabase,
        user.id,
        tutorialId,
        currentStepId
      )
    } else if (action === 'complete') {
      progress = await completeTutorialProgress(
        supabase,
        user.id,
        tutorialId,
        currentStepId ?? getFinalStepId(tutorialId)
      )
    } else {
      progress = await resetTutorialProgress(supabase, user.id, tutorialId)
    }

    return NextResponse.json({ progress })
  } catch (error) {
    console.error('TUTORIAL PROGRESS WRITE ERROR:', error)
    return NextResponse.json(
      { error: 'Unable to save tutorial progress.' },
      { status: 500 }
    )
  }
}
