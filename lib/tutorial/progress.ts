import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  TutorialId,
  TutorialProgress,
  TutorialStatus,
  TutorialStepId,
} from '@/lib/tutorial/types'

interface TutorialProgressRow {
  user_id: string
  tutorial_id: string
  status: TutorialStatus
  current_step_id: string | null
  started_at: string | null
  completed_at: string | null
  updated_at: string
}

function mapTutorialProgress(row: TutorialProgressRow): TutorialProgress {
  return {
    tutorialId: row.tutorial_id,
    status: row.status,
    currentStepId: row.current_step_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  }
}

export async function getTutorialProgress(
  supabase: SupabaseClient,
  userId: string,
  tutorialId: TutorialId
) {
  const { data, error } = await supabase
    .from('tutorial_progress')
    .select('user_id,tutorial_id,status,current_step_id,started_at,completed_at,updated_at')
    .eq('user_id', userId)
    .eq('tutorial_id', tutorialId)
    .maybeSingle<TutorialProgressRow>()

  if (error) throw error
  return data ? mapTutorialProgress(data) : null
}

export async function startTutorialProgress(
  supabase: SupabaseClient,
  userId: string,
  tutorialId: TutorialId,
  firstStepId: TutorialStepId | null
) {
  const existing = await getTutorialProgress(supabase, userId, tutorialId)
  if (existing?.status === 'completed') return existing

  const timestamp = new Date().toISOString()
  const { data, error } = await supabase
    .from('tutorial_progress')
    .upsert(
      {
        user_id: userId,
        tutorial_id: tutorialId,
        status: 'in_progress',
        current_step_id: existing?.currentStepId ?? firstStepId,
        started_at: existing?.startedAt ?? timestamp,
        completed_at: null,
        updated_at: timestamp,
      },
      { onConflict: 'user_id,tutorial_id' }
    )
    .select('user_id,tutorial_id,status,current_step_id,started_at,completed_at,updated_at')
    .single<TutorialProgressRow>()

  if (error) throw error
  return mapTutorialProgress(data)
}

export async function updateTutorialStep(
  supabase: SupabaseClient,
  userId: string,
  tutorialId: TutorialId,
  stepId: TutorialStepId
) {
  const timestamp = new Date().toISOString()
  const { data, error } = await supabase
    .from('tutorial_progress')
    .update({
      status: 'in_progress',
      current_step_id: stepId,
      completed_at: null,
      updated_at: timestamp,
    })
    .eq('user_id', userId)
    .eq('tutorial_id', tutorialId)
    .select('user_id,tutorial_id,status,current_step_id,started_at,completed_at,updated_at')
    .single<TutorialProgressRow>()

  if (error) throw error
  return mapTutorialProgress(data)
}

export async function completeTutorialProgress(
  supabase: SupabaseClient,
  userId: string,
  tutorialId: TutorialId,
  finalStepId: TutorialStepId | null
) {
  const existing = await getTutorialProgress(supabase, userId, tutorialId)
  const timestamp = new Date().toISOString()
  const { data, error } = await supabase
    .from('tutorial_progress')
    .upsert(
      {
        user_id: userId,
        tutorial_id: tutorialId,
        status: 'completed',
        current_step_id: finalStepId,
        started_at: existing?.startedAt ?? timestamp,
        completed_at: timestamp,
        updated_at: timestamp,
      },
      { onConflict: 'user_id,tutorial_id' }
    )
    .select('user_id,tutorial_id,status,current_step_id,started_at,completed_at,updated_at')
    .single<TutorialProgressRow>()

  if (error) throw error
  return mapTutorialProgress(data)
}

export async function resetTutorialProgress(
  supabase: SupabaseClient,
  userId: string,
  tutorialId: TutorialId
) {
  const timestamp = new Date().toISOString()
  const { data, error } = await supabase
    .from('tutorial_progress')
    .upsert(
      {
        user_id: userId,
        tutorial_id: tutorialId,
        status: 'not_started',
        current_step_id: null,
        started_at: null,
        completed_at: null,
        updated_at: timestamp,
      },
      { onConflict: 'user_id,tutorial_id' }
    )
    .select('user_id,tutorial_id,status,current_step_id,started_at,completed_at,updated_at')
    .single<TutorialProgressRow>()

  if (error) throw error
  return mapTutorialProgress(data)
}
