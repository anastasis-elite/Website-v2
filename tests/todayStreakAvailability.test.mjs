import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { loadProgramLogicInputs } = await importTs('lib/dashboard/logic/loadProgramLogicInputs.ts')

function database(history) {
  const reads = []
  return { reads, from(table) {
    const filters = []
    let query
    const result = () => {
      reads.push({ table, filters })
      return table === 'daily_execution_status' ? history : { data: [], error: null }
    }
    query = new Proxy({}, { get(_target, name) {
      if (name === 'then') return (resolve, reject) => Promise.resolve(result()).then(resolve, reject)
      if (name === 'maybeSingle' || name === 'single') return async () => ({ data: null, error: null })
      if (['insert', 'update', 'upsert', 'delete'].includes(name)) throw new Error('The streak availability read must not write')
      return (...args) => { if (name === 'eq') filters.push(args); return query }
    } })
    return query
  } }
}

async function load(history) {
  const supabase = database(history)
  const inputs = await loadProgramLogicInputs({ supabase, user: { id: 'streak-owner' }, client: { client_id: 'streak-client', auth_user_id: 'streak-owner', timezone: 'America/Chicago', program: 'ember' }, program: 'ember', dailyPlan: {}, cycleStatus: {}, cycleAdjustment: {}, plannedWorkout: null, plannedExercises: [], monthlyAssessmentsDueCount: 0 })
  const reads = supabase.reads.filter(read => read.table === 'daily_execution_status')
  assert.equal(reads.length, 1)
  assert.deepEqual(reads[0].filters, [['user_id', 'streak-owner'], ['client_id', 'streak-client']])
  return inputs
}

test('an empty successful owner-scoped history is available for a real zero', async () => {
  const inputs = await load({ data: [], error: null })
  assert.equal(inputs.executionHistoryAvailable, true)
  assert.deepEqual(inputs.executionHistory, [])
})

test('failed or unavailable history stays distinct from a successful empty read', async () => {
  for (const result of [{ data: null, error: { message: 'Unavailable' } }, { data: [], error: { message: 'Unavailable' } }, { data: null, error: null }]) {
    const inputs = await load(result)
    assert.equal(inputs.executionHistoryAvailable, false)
  }
})
