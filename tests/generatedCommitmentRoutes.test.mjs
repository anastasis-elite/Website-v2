import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { dailyPlanToScheduleEvents } = await importTs('lib/schedule/dailyPlanAdapter.ts')
const { getActionRouteForEvent } = await importTs('lib/schedule/engine.ts')

test('generated commitments open their dated daily schedule across tiers and local day boundaries', () => {
  for (const program of ['ember', 'ignite', 'phoenix']) {
    for (const timezone of ['America/Chicago', 'Pacific/Kiritimati', 'Pacific/Honolulu']) {
      const date = '2026-10-17'
      const events = dailyPlanToScheduleEvents({ userId: 'qa-only', client: {
        client_id: 'QA-ROUTING-ONLY', program, work_start_time: '00:15', work_end_time: '02:00',
        school_dropoff_time: '08:00', school_pickup_time: '15:00', preferred_workout_time: '16:00',
        lunch_window_time: '12:00', dinner_window_time: '18:00',
      }, dailyPlan: { date, timezone, timing: {}, completedDailyTasks: [] } })
      const commitments = events.filter(event => ['work', 'school'].includes(event.event_type))
      assert.equal(commitments.length, 3)
      for (const event of commitments) {
        const expected = `/dashboard/schedule?date=${date}#event-${event.id}`
        assert.equal(event.action_route, expected)
        assert.equal(getActionRouteForEvent(event, program), expected)
      }
      assert.equal(getActionRouteForEvent(events.find(event => event.event_type === 'workout'), program), `/dashboard/program/${program}/workout`)
      assert.equal(getActionRouteForEvent(events.find(event => event.event_type === 'recovery'), program), '/dashboard/day/evening')
      assert.ok(events.every(event => !getActionRouteForEvent(event, program).startsWith('/dashboard/assessment/daily-structure')))
    }
  }
})

// Exercise the actual server page so occurrence links cannot silently load Today.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

test('Schedule server page forwards one valid local date and rejects absent, malformed, rollover or array dates', async () => {
  const calls = [], Component = () => null, require = createRequire(import.meta.url)
  const mocks = {
    './ScheduleDashboardClient': Component,
    '@/lib/dashboard/getDashboardContext': { getDashboardContext: async () => ({ supabase: 'mock', user: { id: 'qa' }, client: { client_id: 'QA-DATE' } }) },
    '@/lib/schedule/service': { getDailyScheduleState: async args => { calls.push(args); return { date: args.date || 'today' } } },
    'react/jsx-runtime': require('react/jsx-runtime'),
  }
  const module = { exports: {} }
  const compiled = ts.transpileModule(readFileSync('app/dashboard/schedule/page.tsx', 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  runInNewContext(compiled, { module, exports: module.exports, Date,
    require(name) { assert.ok(name in mocks, `Unexpected page dependency: ${name}`); return mocks[name] },
  })
  for (const date of ['2026-10-12', '2028-02-29', undefined, '', '2026-02-30', '2026-13-01', '2026-1-2', 'invalid', ['2026-10-12'], ['2026-10-12', '2026-10-13']]) {
    const page = await module.exports.default({ searchParams: Promise.resolve({ date }) })
    const expected = typeof date === 'string' && ['2026-10-12', '2028-02-29'].includes(date) ? date : undefined
    assert.equal(calls.at(-1).date, expected)
    assert.equal(page.type, Component)
    assert.equal(page.props.initialSchedule.date, expected || 'today')
  }
})
