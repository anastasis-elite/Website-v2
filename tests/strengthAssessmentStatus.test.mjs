import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { importTs } from './typescriptModule.mjs'

const { getStrengthAssessmentStatus, getStrengthAssessmentPeriod, getStrengthAssessmentDetail } = await importTs('lib/assessment/getStrengthAssessmentStatus.ts')
const client = { client_id: 'synthetic-client-a', auth_user_id: 'synthetic-user-a', timezone: 'America/Chicago' }
const october = new Date('2026-10-16T18:00:00Z')

function database(tables, failures = {}) {
  const reads = []
  return {
    reads,
    from(table) {
      const filters = [], orders = []
      let fields = '', maximum = Infinity
      const query = {
        select(value) { fields = value; return query },
        eq(key, value) { filters.push(row => row[key] === value); return query },
        gte(key, value) { filters.push(row => row[key] >= value); return query },
        lt(key, value) { filters.push(row => row[key] < value); return query },
        or(value) {
          const match = /^assessment_period\.eq\.(\d{4}-\d{2}-01),and\(assessment_period\.is\.null,submitted_at\.gte\.([^,]+),submitted_at\.lt\.([^\)]+)\)$/.exec(value)
          assert.ok(match, 'period query must explicitly distinguish legacy completion timestamps')
          filters.push(row => row.assessment_period === match[1] || (row.assessment_period == null && row.submitted_at >= match[2] && row.submitted_at < match[3]))
          return query
        },
        order(key, { ascending }) { orders.push({ key, ascending }); return query },
        limit(value) { maximum = value; return query },
        async maybeSingle() {
          reads.push({ table, fields })
          if (failures[table]) return { data: null, error: { message: 'Synthetic unavailable source' } }
          let rows = (tables[table] || []).filter(row => filters.every(filter => filter(row)))
          for (const { key, ascending } of orders) rows = rows.toSorted((left, right) => String(left[key]).localeCompare(String(right[key])) * (ascending ? 1 : -1))
          return { data: rows.slice(0, maximum)[0] || null, error: null }
        },
      }
      return query
    },
  }
}

function session(overrides = {}) {
  return { client_id: client.client_id, auth_user_id: client.auth_user_id, period: '2026-10-01', status: 'draft', saved_at: '2026-10-16T17:20:00Z', completed_at: null, assessment_id: null, ...overrides }
}

function assessment(overrides = {}) {
  return { id: 'synthetic-final', client_id: client.client_id, assessment_type: 'strength', submitted_at: '2026-10-16T17:00:00Z', ...overrides }
}

test('partially saved strength stays in progress without satisfying monthly completion', async () => {
  const db = database({ strength_assessment_sessions: [session()], assessments: [assessment({ assessment_type: 'monthly' })] })
  const status = await getStrengthAssessmentStatus(db, client, october)
  assert.equal(status.state, 'draft')
  assert.equal(status.label, 'In Progress')
  assert.equal(status.completedAt, null)
  assert.equal(status.savedAt, '2026-10-16T17:20:00Z')
  assert.equal(status.actionLabel, 'Resume Assessment')
  assert.match(getStrengthAssessmentDetail(status, client), /Last saved October 16, 2026/)
  assert.ok(db.reads.every(read => !read.fields.includes('values') && !read.fields.includes('data')))
})

test('existing October final submissions clear strength Due and preserve original assessment date', async () => {
  const original = assessment({ id: 'synthetic-original', submitted_at: '2026-10-16T16:00:00Z' })
  const db = database({ strength_assessment_sessions: [session()], assessments: [assessment(), original] })
  const status = await getStrengthAssessmentStatus(db, client, october)
  assert.equal(status.state, 'completed')
  assert.equal(status.label, 'Completed')
  assert.equal(status.completedAt, original.submitted_at)
  assert.equal(status.assessmentId, original.id)
  assert.equal(status.actionLabel, 'View Saved Results')
  assert.equal(db.reads.some(read => read.table === 'assessments'), true)
})

test('confirmed atomic completion is recognized even if legacy history read is unavailable', async () => {
  const db = database({ strength_assessment_sessions: [session({ status: 'completed', completed_at: '2026-10-16T17:30:00Z', assessment_id: 'synthetic-completed' })] }, { assessments: true })
  const status = await getStrengthAssessmentStatus(db, client, october)
  assert.equal(status.state, 'completed')
  assert.equal(status.unavailable, false)
})

test('a failed status read never presents Due or completed without confirmation', async () => {
  const status = await getStrengthAssessmentStatus(database({}, { assessments: true }), client, october)
  assert.equal(status.state, 'unavailable')
  assert.equal(status.label, 'Status unavailable')
  assert.equal(status.completedAt, null)
})

test('month rollover keeps previous values resumable without completing the new month', async () => {
  const db = database({ strength_assessment_sessions: [session()], assessments: [assessment({ submitted_at: '2026-09-18T17:00:00Z' })] })
  const status = await getStrengthAssessmentStatus(db, client, new Date('2026-11-01T18:00:00Z'))
  assert.equal(status.period, '2026-11-01')
  assert.equal(status.state, 'due')
  assert.equal(status.previousDraft.period, '2026-10-01')
  assert.equal(status.previousDraft.href, '/dashboard/assessment/start2?period=2026-10-01')
  assert.equal(status.previousDraft.savedAt, '2026-10-16T17:20:00Z')
})

test('monthly periods and legacy completion use the member timezone at UTC month boundaries', async () => {
  const beforeLocalMidnight = new Date('2026-11-01T02:00:00Z')
  assert.equal(getStrengthAssessmentPeriod(client, beforeLocalMidnight), '2026-10-01')
  const db = database({ assessments: [assessment({ submitted_at: '2026-11-01T01:30:00Z' })] })
  const octoberStatus = await getStrengthAssessmentStatus(db, client, beforeLocalMidnight)
  const novemberStatus = await getStrengthAssessmentStatus(db, client, new Date('2026-11-01T12:00:00Z'))
  assert.equal(octoberStatus.state, 'completed')
  assert.equal(novemberStatus.state, 'due')
})

test('another account drafts and completions cannot alter this member status', async () => {
  const db = database({
    strength_assessment_sessions: [session({ auth_user_id: 'synthetic-user-b' }), session({ client_id: 'synthetic-client-b' })],
    assessments: [assessment({ client_id: 'synthetic-client-b' })],
  })
  const status = await getStrengthAssessmentStatus(db, client, october)
  assert.equal(status.state, 'due')
  assert.equal(status.savedAt, null)
  assert.equal(status.completedAt, null)
})

test('finishing an earlier draft later records only the original month as complete', async () => {
  const db = database({ assessments: [assessment({ assessment_period: '2026-10-01', submitted_at: '2026-11-01T18:00:00Z' })] })
  const octoberStatus = await getStrengthAssessmentStatus(db, client, october)
  const novemberStatus = await getStrengthAssessmentStatus(db, client, new Date('2026-11-01T18:00:00Z'))
  assert.equal(octoberStatus.state, 'completed')
  assert.equal(octoberStatus.completedAt, '2026-11-01T18:00:00Z')
  assert.equal(novemberStatus.state, 'due')
})

test('dashboard and workout strength cards use strength status independently of monthly check-in', () => {
  for (const path of ['components/program-dashboard/TierAwareDashboardWorkspace.tsx', 'components/workout-dashboard/WorkoutDashboard.tsx']) {
    const source = readFileSync(path, 'utf8')
    assert.match(source, /logic\.assessments\.strength/)
    assert.doesNotMatch(source, /monthlyDueCount \? 'Due' : 'Current'/)
  }
  assert.match(readFileSync('app/dashboard/progress/page.tsx', 'utf8'), /StrengthAssessmentSummary status=\{logic\.assessments\.strength\}/)
})
