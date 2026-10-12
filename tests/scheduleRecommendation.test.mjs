import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { getDailyScheduleState } = await importTs('lib/schedule/service.ts', {
  '@/lib/calendar/service': 'export const importedScheduleEvents = async () => []',
  '@/lib/day/getDailyExecutionPlan': "export const getDailyExecutionPlan = async () => ({ date: '2026-08-17', timing: {}, completedDailyTasks: [] })",
  '@/lib/dashboard/logic/getProgramLogicForClient': 'export const getProgramLogicForClient = async () => null',
})
const { buildWhatsNextState } = await importTs('lib/dashboard/whatsNext.ts')
const { getTierCapabilities } = await importTs('lib/entitlements.ts')

const client = { client_id: 'QA-ONLY', program: 'ember', timezone: 'America/Chicago', onboarding_data: {} }
const event = { id: 'qa-overdue', user_id: 'qa-user', client_id: client.client_id, event_type: 'custom', title: 'Review appointment notes',
  status: 'scheduled', source: 'manual', priority: 'medium', flexibility_type: 'flexible', movable: true, approval_required: false,
  start_at: '2026-08-17T14:00:00.000Z', end_at: '2026-08-17T14:30:00.000Z', adjusted_start_at: null, adjusted_end_at: null, estimated_duration_minutes: 30 }
const logic = () => ({ program: 'ember', nutrition: { dataStatus: 'needs_input', calories: { percent: 0 }, protein: { percent: 0 } },
  hydration: { status: 'needs_input', remaining: 100 }, assessments: { dailyCompleted: true }, execution: { workoutComplete: false },
  workout: { assigned: false }, workoutDecision: { canTrain: true, adjustmentLevel: 'level_0_full_plan', reasonForModification: 'Planned training is available.' },
  symptoms: { redFlag: false }, recoveryStatus: { reasoning: 'Review recovery guidance.' } })
function database(events) {
  return { from(table) {
    const result = { data: table === 'anastasis_schedule_events' ? events : [], error: null }
    const query = { select() { return query }, eq() { return query }, or() { return query }, order: async () => result,
      then(resolve) { return Promise.resolve(result).then(resolve) } }
    return query
  } }
}

test('shared recommendation preserves overdue timing, actions and details across schedule and What’s Next', async () => {
  const currentLogic = logic()
  const state = await getDailyScheduleState({ supabase: database([event]), user: { id: 'qa-user' }, client, date: '2026-08-17', logic: currentLogic })
  assert.equal(state.dailyRecommendation.primary.eventId, event.id)
  assert.equal(state.nextAction.id, event.id)
  assert.equal(state.nextAction.start_at, event.start_at)
  assert.equal(state.nextAction.overdue, true)
  assert.equal(state.nextAction.urgency, 'overdue')
  assert.equal(state.nextAction.can_complete, true)
  assert.equal(state.nextAction.can_defer, true)
  const next = buildWhatsNextState({ tier: 'ember', capabilities: getTierCapabilities('ember'), logic: currentLogic, schedule: state })
  assert.equal(next.title, state.nextAction.title)
  assert.equal(next.subtitle, state.nextAction.reason)
  assert.equal(next.startTime, event.start_at)
  assert.equal(next.endTime, event.end_at)
  assert.equal(next.primaryAction.href, '/dashboard/schedule#event-qa-overdue')
})

test('a safety recommendation resets unrelated event timing and completion controls', async () => {
  const currentLogic = logic(); currentLogic.symptoms.redFlag = true
  const state = await getDailyScheduleState({ supabase: database([event]), user: { id: 'qa-user' }, client, date: '2026-08-17', logic: currentLogic })
  assert.equal(state.nextAction.id, 'safety')
  assert.equal(state.nextAction.category, 'recovery')
  assert.equal(state.nextAction.start_at, null)
  assert.equal(state.nextAction.overdue, false)
  assert.equal(state.nextAction.can_complete, false)
  assert.equal(state.nextAction.can_defer, false)
})
