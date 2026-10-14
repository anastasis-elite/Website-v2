import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { importTs } from '../tests/typescriptModule.mjs'

// Disposable transport experiment, NOT browser/PWA/device startup timings.
// The fixed latency makes the serial dependency removed by this release visible.
const delayMs = 40
const pause = () => new Promise(resolve => setTimeout(resolve, delayMs))
const baselineRef = process.argv[2] || 'HEAD'
const baselineGitSha = execFileSync('git', ['rev-parse', baselineRef], { encoding: 'utf8' }).trim()
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'anastasis-loader-baseline-'))
const baselineFile = join(temporaryDirectory, 'service.ts')
writeFileSync(baselineFile, execFileSync('git', ['show', `${baselineGitSha}:lib/schedule/service.ts`]))
const mocks = {
  '@/lib/calendar/service': 'export const importedScheduleEvents = async () => { globalThis.loaderMeasurement.reads++; await globalThis.loaderMeasurement.pause(); return [] }',
  '@/lib/day/getDailyExecutionPlan': 'export const getDailyExecutionPlan = async () => { globalThis.loaderMeasurement.reads++; await globalThis.loaderMeasurement.pause(); return { date: "2026-10-14" } }',
  '@/lib/dashboard/logic/getProgramLogicForClient': 'export const getProgramLogicForClient = async () => ({})',
  '@/lib/dashboard/todayActivities': 'export const buildTodayActivities = () => ({}); export const readDailyGuide = () => undefined',
  '@/lib/dashboard/dailyRecommendation': 'export const buildDailyRecommendation = () => ({primary: {id: "check-in",title: "Check-in",category: "check_in",reason: "Start with you",href: "/dashboard/check-in"}})',
  './time': 'export const getClientDayRange = () => ({date: "2026-10-14",timezone: "UTC",start: new Date("2026-10-14T00:00:00Z"),end: new Date("2026-10-15T00:00:00Z")}); export const zonedDateTimeToUtc = () => new Date("2026-10-14T00:00:00Z")',
  './dailyPlanAdapter': 'export const dailyPlanToScheduleEvents = () => []; export const recurringCommitmentsToEvents = () => []',
  './engine': 'export const buildNextAction = () => null; export const buildDailyScheduleState = args => ({...args,now: args.now.toISOString(),openWindows:[],adjustments:[],nextAction:{can_defer:true}})',
}
const baseline = (await importTs(baselineFile, mocks)).getDailyScheduleState
const updated = (await importTs('lib/schedule/service.ts', mocks)).getDailyScheduleState

async function measure(load) {
  const results = []
  for (let index = 0; index < 5; index++) {
    const fixture = globalThis.loaderMeasurement = { pause, reads: 0 }
    const supabase = { from() {
      const query = { select() { return query }, eq() { return query }, or() { return query }, order() { return query },
        async then(resolve) { fixture.reads++; await pause(); resolve({ data: [], error: null }) } }
      return query
    } }
    const started = performance.now()
    await load({ supabase, user: { id: 'disposable-owner' }, client: { client_id: 'disposable-client', program: 'ignite' },
      date: '2026-10-14', logic: {}, dailyPlan: { date: '2026-10-14' } })
    results.push({ durationMs: Math.round((performance.now() - started) * 100) / 100, reads: fixture.reads })
  }
  const durations = results.map(value => value.durationMs).sort((a, b) => a - b)
  return { samples: results, medianMs: durations[2] }
}

const before = await measure(baseline)
const after = await measure(updated)
const result = { kind: 'Synthetic Node transport experiment. Not real mobile, browser, or installed-PWA startup performance.',
  capturedAt: new Date().toISOString(), baseline: 'Schedule loader at baselineGitSha', baselineGitSha, artificialReadLatencyMs: delayMs,
  before, after, medianReductionPercent: Math.round((1 - after.medianMs / before.medianMs) * 10000) / 100 }
writeFileSync('docs/mobile-pwa-loader-latency-2026-10-14.json', JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
