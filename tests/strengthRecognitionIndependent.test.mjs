import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { importTs } from './typescriptModule.mjs'
import { client, final, draft, database } from './strengthSchedulingFixture.mjs'

const { getStrengthAssessmentStatus, getStrengthAssessmentPeriod, getStrengthAssessmentDetail } = await importTs('lib/assessment/getStrengthAssessmentStatus.ts')
const now = new Date('2026-11-03T18:00:00Z')

test('first baseline stays available with no completed strength; initial/monthly records and drafts are not anchors', async () => {
  const db = database({ assessments: [final('2026-11-01T12:00:00Z', { assessment_type: 'initial' }), final('2026-11-02T12:00:00Z', { assessment_type: 'monthly' })], sessions: [draft('2026-11-01', '2026-11-03T17:00:00Z')] })
  const status = await getStrengthAssessmentStatus(db, client, now)
  assert.equal(status.state, 'draft'); assert.equal(status.eligible, true); assert.equal(status.latestCompletedAt, null)
  assert.equal(status.scheduledDate, '2026-11-03'); assert.equal(status.actionLabel, 'Resume Assessment'); db.verify()
})

test('latest final controls the three-month cadence, independent of monthly review count and draft update time', async () => {
  const latest = final('2026-10-16T17:00:00Z', { id: 'latest' })
  const db = database({ assessments: [final('2026-07-01T12:00:00Z'), latest], sessions: [draft('2026-11-01', '2026-11-03T17:59:00Z')] })
  const status = await getStrengthAssessmentStatus(db, client, now)
  assert.equal(status.state, 'draft'); assert.equal(status.eligible, false)
  assert.equal(status.latestCompletedAt, latest.submitted_at); assert.equal(status.eligibleDate, '2027-01-16'); assert.equal(status.scheduledDate, '2027-01-18')
  assert.equal(status.savedAt, '2026-11-03T17:59:00Z'); db.verify()
})

test('an earlier month final stays completed until eligible and links to its exact historical receipt', async () => {
  const latest = final('2026-10-16T17:00:00Z', { id: 'original' })
  const db = database({ assessments: [latest], sessions: [draft('2026-09-01', '2026-09-20T12:00:00Z')] })
  const status = await getStrengthAssessmentStatus(db, client, now)
  assert.equal(status.state, 'completed'); assert.equal(status.completedAt, latest.submitted_at)
  assert.equal(status.href, '/dashboard/assessment/start2?period=2026-10-01&assessmentId=original')
  assert.equal(status.previousDraft.period, '2026-09-01'); assert.match(getStrengthAssessmentDetail(status, client), /Next eligible date: January 16, 2027/)
  db.verify()
})

test('final timestamps are converted to the authoritative member-local calendar date before adding months', async () => {
  const db = database({ assessments: [final('2026-09-01T02:30:00Z')] })
  const status = await getStrengthAssessmentStatus(db, client, now)
  assert.equal(status.eligibleDate, '2026-11-30'); assert.equal(status.scheduledDate, '2026-11-30')
  assert.equal(getStrengthAssessmentPeriod(client, new Date('2026-11-01T02:00:00Z')), '2026-10-01'); db.verify()
})

test('owned metadata excludes other accounts, other assessment types and future submissions', async () => {
  const db = database({ assessments: [final('2026-10-01T12:00:00Z', { auth_user_id: 'other' }), final('2026-10-01T12:00:00Z', { client_id: 'other' }), final('2026-11-04T12:00:00Z')] })
  const status = await getStrengthAssessmentStatus(db, client, now)
  assert.equal(status.latestCompletedAt, null); assert.equal(status.state, 'due'); db.verify()
})

test('history errors and invalid transport metadata never invent a baseline or a due workout', async () => {
  for (const options of [{ fail: ['assessments'] }, { forcedFinal: { submitted_at: 'bad' } }, { forcedFinal: final('2027-01-01T12:00:00Z') }]) {
    const db = database(options), status = await getStrengthAssessmentStatus(db, client, now)
    assert.equal(status.unavailable, true); assert.notEqual(status.isWorkoutDay, true); db.verify()
  }
  for (const identity of [null, {}, { client_id: client.client_id }]) {
    const db = database(), status = await getStrengthAssessmentStatus(db, identity, now)
    assert.equal(status.state, 'unavailable'); assert.equal(db.reads.length, 0)
  }
})

test('known published final recognition survives draft-table outage; a missing baseline remains unavailable', async () => {
  const db = database({ assessments: [final('2026-10-16T12:00:00Z')], fail: ['strength_assessment_sessions'] })
  const status = await getStrengthAssessmentStatus(db, client, now)
  assert.equal(status.state, 'completed'); assert.equal(status.unavailable, false); db.verify()
  assert.equal((await getStrengthAssessmentStatus(database({ fail: ['strength_assessment_sessions'] }), client, now)).state, 'unavailable')
})

test('Monday complete evidence uses the existing fifty-percent rule; Tuesday assignment persists after reload', async () => {
  const monday = new Date('2026-11-09T18:00:00Z')
  const exercise = { id: 'squat', name: 'Squat', sets: 4, planned_sets: 4, reps: 8 }
  const sets = [1,2].map(set_number => ({ id: `set-${set_number}`, set_number, reps: 8, weight: 50, completed_at: '2026-11-09T17:00:00Z' }))
  const workout = { id: 'workout', client_id: client.client_id, auth_user_id: client.auth_user_id, workout_date: '2026-11-09', workout_started_at: '2026-11-09T16:00:00Z', workout_source: 'recommended', completed: false, planned_exercises: [exercise], exercise_logs: [{ ...exercise, set_logs: sets }] }
  const db = database({ assessments: [final('2026-08-03T12:00:00Z')], workouts: [workout] })
  for (const instant of [monday, new Date('2026-11-10T18:00:00Z')]) {
    const status = await getStrengthAssessmentStatus(db, client, instant)
    assert.equal(status.eligibleDate, '2026-11-03'); assert.equal(status.scheduledDate, '2026-11-10')
    assert.equal(status.isWorkoutDay, instant.getUTCDate() === 10)
  }
  const below = database({ assessments: [final('2026-08-03T12:00:00Z')], workouts: [{ ...workout, completed: true, exercise_logs: [{ ...exercise, set_logs: sets.slice(0,1) }] }] })
  assert.equal((await getStrengthAssessmentStatus(below, client, monday)).scheduledDate, '2026-11-09')
  db.verify(); below.verify()
})

test('foreign/other-day/future workout evidence cannot cause Tuesday deferral; unreadable Monday is unknown', async () => {
  const monday = new Date('2026-11-09T18:00:00Z'), assessment = final('2026-08-03T12:00:00Z')
  const workout = { id: 'w', client_id: client.client_id, auth_user_id: client.auth_user_id, completed: true, workout_date: '2026-11-09' }
  const db = database({ assessments: [assessment], workouts: [{ ...workout, auth_user_id: 'other' }, { ...workout, workout_date: '2026-11-08' }, { ...workout, workout_started_at: '2026-11-09T23:00:00Z' }] })
  assert.equal((await getStrengthAssessmentStatus(db, client, monday)).scheduledDate, '2026-11-09'); db.verify()
  const unavailable = await getStrengthAssessmentStatus(database({ assessments: [assessment], fail: ['workout_logs'] }), client, monday)
  assert.equal(unavailable.unavailable, true); assert.notEqual(unavailable.isWorkoutDay, true)
})

for (const path of ['components/program-dashboard/DashboardDetailPanels.tsx', 'components/workout-dashboard/WorkoutDashboard.tsx']) test(`${path} still uses independent strength recognition`, () => {
  const source = readFileSync(path, 'utf8')
  assert.match(source, /logic\.assessments\.strength/); assert.match(source, /href=\{strength(?:Assessment)?\.href\}/)
  assert.doesNotMatch(source, /monthlyDueCount\s*\?\s*['"]Due/)
})

test('published same-period final wins over an orphaned draft without changing either record',async()=>{
  const db=database({assessments:[final('2026-11-02T12:00:00Z',{id:'original-final',assessment_period:'2026-11-01'})],sessions:[draft('2026-11-01','2026-11-03T12:00:00Z')]})
  const status=await getStrengthAssessmentStatus(db,client,now)
  assert.equal(status.state,'completed');assert.equal(status.assessmentId,'original-final');assert.equal(status.eligible,false)
  assert.match(status.href,/assessmentId=original-final/);db.verify()
})
