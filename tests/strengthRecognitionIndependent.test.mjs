import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { importTs } from './typescriptModule.mjs'

const { getStrengthAssessmentStatus, getStrengthAssessmentPeriod, getStrengthAssessmentDetail } =
  await importTs('lib/assessment/getStrengthAssessmentStatus.ts')
const client = { client_id: 'synthetic-client-a', auth_user_id: 'synthetic-owner-a', timezone: 'America/Chicago' }
const now = new Date('2026-10-16T18:00:00Z')
const clone = value => structuredClone(value)
const assessment = (changes = {}) => ({
  id: 'synthetic-final', client_id: client.client_id, auth_user_id: client.auth_user_id,
  assessment_type: 'strength', submitted_at: '2026-10-16T17:00:00Z', ...changes,
})

// This strict in-process metadata transport deliberately has no credentials or
// network. It exercises the real reader, not live Supabase/RLS acceptance.
function database(rows = [], options = {}) {
  const original = clone(rows), history = clone(rows), reads = [], violations = []
  function requirePolicy(condition, message) {
    if (!condition) { violations.push(message); throw new Error(message) }
  }
  const db = { reads, violations, history, from(table) {
    if (table === 'strength_assessment_sessions') {
      const filters = []; let projection, maximum, order
      const q = {
        select(columns) { projection = columns; requirePolicy(!columns.includes('values'), 'Draft recognition reads metadata only'); return q },
        eq(key, value) { filters.push(['eq',key,value]); return q },
        lt(key,value) { filters.push(['lt',key,value]); return q },
        lte(key,value) { filters.push(['lte',key,value]); return q },
        order(key,settings) { order=[key,settings.ascending]; return q },
        limit(value) { maximum=value; return q },
        async maybeSingle() {
          requirePolicy(filters.some(([op,key,value])=>op==='eq'&&key==='client_id'&&value===client.client_id), 'Draft client scope missing')
          requirePolicy(filters.some(([op,key,value])=>op==='eq'&&key==='auth_user_id'&&value===client.auth_user_id), 'Draft owner scope missing')
          if(options.failSessions)return{data:null,error:{message:'Draft unavailable'}}
          let results=(options.sessions||[]).filter(row=>filters.every(([op,key,value])=>op==='eq'?row[key]===value:op==='lt'?row[key]<value:row[key]<=value))
          if(order)results=results.sort((a,b)=>String(a[order[0]]).localeCompare(String(b[order[0]]))*(order[1]?1:-1))
          if(maximum)results=results.slice(0,maximum)
          const found=results[0]
          return{data:found?Object.fromEntries(projection.split(',').map(key=>[key,found[key]])):null,error:null}
        },
      }
      return q
    }
    requirePolicy(table === 'assessments', `Unexpected table: ${table}`)
    const filters = [], orders = []
    let projection, maximum
    const q = {
      select(columns) {
        requirePolicy(columns === 'id,submitted_at,assessment_period', `Unexpected metadata projection: ${columns}`)
        requirePolicy(projection === undefined, 'Repeated projection')
        projection = columns; return q
      },
      or(value) { requirePolicy(/^assessment_period\.is\.null,assessment_period\.eq\.\d{4}-\d{2}-01$/.test(value),'Unexpected period scope'); filters.push({operator:'period',key:'assessment_period',value:value.split('.eq.')[1]});return q },
      eq(key, value) {
        requirePolicy(['client_id', 'auth_user_id', 'assessment_type'].includes(key), `Unexpected equality filter: ${key}`)
        requirePolicy(!filters.some(filter => filter.operator === 'eq' && filter.key === key), `Repeated filter: ${key}`)
        filters.push({ operator: 'eq', key, value }); return q
      },
      gte(key, value) { return range('gte', key, value) },
      lt(key, value) { return range('lt', key, value) },
      lte(key, value) { return range('lte', key, value) },
      order(key, settings) {
        requirePolicy(key === 'submitted_at' && settings?.ascending === true, 'Completion must retain the earliest saved date')
        orders.push({ key, ascending: true }); return q
      },
      limit(value) { requirePolicy(value === 1, 'Only one completion metadata row is needed'); maximum = value; return q },
      async maybeSingle() {
        requirePolicy(projection === 'id,submitted_at,assessment_period', 'Projection missing')
        const eq = Object.fromEntries(filters.filter(filter => filter.operator === 'eq').map(filter => [filter.key, filter.value]))
        requirePolicy(eq.client_id === client.client_id && eq.auth_user_id === client.auth_user_id && eq.assessment_type === 'strength', 'Missing owner/client/type scope')
        requirePolicy(['gte', 'lt', 'lte'].every(operator => filters.filter(filter => filter.operator === operator).length === 1), 'Missing month/future timestamp bounds')
        requirePolicy(orders.length === 1 && maximum === 1, 'Missing deterministic first completion limit')
        reads.push({ table, projection, filters: clone(filters), orders: clone(orders), maximum })
        if (options.throwRead) throw new Error('Synthetic metadata read unavailable')
        if (options.fail) return { data: null, error: { message: 'Synthetic metadata read unavailable' } }
        if (Object.hasOwn(options, 'forcedData')) return { data: clone(options.forcedData), error: null }
        const found = history.filter(row => filters.every(({ operator, key, value }) => {
          if (operator === 'eq') return row[key] === value
          if (operator === 'period') return row[key] == null || row[key] === value
          const stored = Date.parse(row[key]), boundary = Date.parse(value)
          return Number.isFinite(stored) && (operator === 'gte' ? stored >= boundary : operator === 'lt' ? stored < boundary : stored <= boundary)
        })).sort((left, right) => Date.parse(left.submitted_at) - Date.parse(right.submitted_at))
        const selected = found[0]
        // The actual response exposes neither health answers nor identifiers
        // beyond the two explicitly selected metadata fields.
        return { data: selected ? { id: selected.id, submitted_at: selected.submitted_at, assessment_period:selected.assessment_period } : null, error: null }
      },
    }
    function range(operator, key, value) {
      requirePolicy(key === 'submitted_at' && typeof value === 'string' && Number.isFinite(Date.parse(value)), `Unexpected ${operator} bound`)
      filters.push({ operator, key, value }); return q
    }
    return new Proxy(q, { get(target, key) {
      if (key in target) return target[key]
      requirePolicy(false, `Unexpected query method: ${String(key)}`)
    } })
  } }
  db.verify = () => {
    assert.deepEqual(violations, [], 'The reader must stay within the metadata-only query contract')
    assert.deepEqual(history, original, 'Recognition must never alter submitted history')
  }
  return db
}

test('an owned current-month final completes strength independently of an outstanding monthly check-in', async () => {
  const db = database([assessment()]), status = await getStrengthAssessmentStatus(db, client, now)
  const monthlyCheckIn = { monthlyDueCount: 3, strength: status }
  assert.equal(monthlyCheckIn.monthlyDueCount, 3)
  assert.equal(monthlyCheckIn.strength.state, 'completed'); assert.equal(status.label, 'Completed')
  assert.equal(status.completedAt, '2026-10-16T17:00:00Z'); assert.equal(status.assessmentId, 'synthetic-final')
  assert.equal(status.unavailable, false); assert.equal(db.reads.length, 1)
  db.verify()
})

test('multiple final submissions retain the original completion date without rewriting history', async () => {
  const original = assessment({ id: 'synthetic-original', submitted_at: '2026-10-03T15:00:00Z' })
  const db = database([assessment(), original]), status = await getStrengthAssessmentStatus(db, client, now)
  assert.equal(status.state, 'completed'); assert.equal(status.completedAt, original.submitted_at)
  assert.equal(status.assessmentId, original.id); db.verify()
})

test('an older strength final does not complete this month', async () => {
  const db = database([assessment({ submitted_at: '2026-09-16T17:00:00Z' })])
  const status = await getStrengthAssessmentStatus(db, client, now)
  assert.equal(status.state, 'due'); assert.equal(status.label, 'Due'); assert.equal(status.completedAt, null)
  db.verify()
})

test('monthly and other assessment types cannot complete strength', async () => {
  const db = database([assessment({ assessment_type: 'monthly' }), assessment({ assessment_type: 'daily' })])
  assert.equal((await getStrengthAssessmentStatus(db, client, now)).state, 'due'); db.verify()
})

test('foreign-owner and foreign-client final submissions cannot complete this member', async () => {
  const db = database([
    assessment({ auth_user_id: 'synthetic-other-owner' }), assessment({ client_id: 'synthetic-other-client' }),
  ])
  const status = await getStrengthAssessmentStatus(db, client, now)
  assert.equal(status.state, 'due'); assert.equal(status.assessmentId, null); assert.equal(status.completedAt, null)
  db.verify()
})

test('the member-local month includes UTC next-month submissions before local midnight', async () => {
  const lateOctober = new Date('2026-11-01T02:00:00Z')
  const db = database([assessment({ submitted_at: '2026-11-01T01:30:00Z' })])
  assert.equal(getStrengthAssessmentPeriod(client, lateOctober), '2026-10-01')
  const october = await getStrengthAssessmentStatus(db, client, lateOctober)
  assert.equal(october.state, 'completed'); assert.equal(october.period, '2026-10-01')
  const november = await getStrengthAssessmentStatus(db, client, new Date('2026-11-01T12:00:00Z'))
  assert.equal(november.period, '2026-11-01'); assert.equal(november.state, 'due')
  const octoberBounds = db.reads[0].filters.filter(filter => !['eq','period'].includes(filter.operator))
  assert.deepEqual(octoberBounds.map(({ operator, value }) => [operator, value]), [
    ['gte', '2026-10-01T05:00:00.000Z'], ['lt', '2026-11-01T05:00:00.000Z'], ['lte', lateOctober.toISOString()],
  ])
  db.verify()
})

test('the exact member-local month start is inclusive and next month start is exclusive', async () => {
  const exactStart = database([assessment({ submitted_at: '2026-10-01T05:00:00Z' })])
  assert.equal((await getStrengthAssessmentStatus(exactStart, client, now)).state, 'completed'); exactStart.verify()
  const beforeStart = database([assessment({ submitted_at: '2026-10-01T04:59:59.999Z' })])
  assert.equal((await getStrengthAssessmentStatus(beforeStart, client, now)).state, 'due'); beforeStart.verify()
  const nextStart = database([assessment({ submitted_at: '2026-11-01T05:00:00Z' })])
  assert.equal((await getStrengthAssessmentStatus(nextStart, client, now)).state, 'due'); nextStart.verify()
})

test('failed or thrown metadata reads present Status unavailable rather than Due', async () => {
  for (const options of [{ fail: true }, { throwRead: true }]) {
    const db = database([assessment()], options), status = await getStrengthAssessmentStatus(db, client, now)
    assert.equal(status.state, 'unavailable'); assert.equal(status.label, 'Status unavailable')
    assert.equal(status.unavailable, true); assert.equal(status.completedAt, null)
    assert.equal(status.assessmentId, null); assert.equal(db.reads.length, 1); db.verify()
  }
})

test('missing owner or client identity is unavailable without issuing any query', async () => {
  for (const identity of [null, {}, { client_id: client.client_id }, { auth_user_id: client.auth_user_id }]) {
    const db = database([assessment()]), status = await getStrengthAssessmentStatus(db, identity, now)
    assert.equal(status.state, 'unavailable'); assert.equal(status.label, 'Status unavailable')
    assert.equal(db.reads.length, 0); assert.equal(status.completedAt, null); db.verify()
  }
})

test('invalid, missing and future submission timestamps do not confirm completion', async () => {
  const db = database([
    assessment({ submitted_at: 'invalid-date' }), assessment({ submitted_at: null }),
    assessment({ submitted_at: '2026-10-16T18:00:00.001Z' }), assessment({ submitted_at: '2027-10-16T17:00:00Z' }),
  ])
  assert.equal((await getStrengthAssessmentStatus(db, client, now)).state, 'due'); db.verify()
  const exactNow = database([assessment({ submitted_at: now.toISOString() })])
  assert.equal((await getStrengthAssessmentStatus(exactNow, client, now)).state, 'completed'); exactNow.verify()
})

test('the reader defensively rejects out-of-range metadata even when a transport returns it', async () => {
  for (const submitted_at of ['invalid-date', null, '2026-09-16T17:00:00Z', '2026-10-16T18:00:00.001Z', '2026-11-01T05:00:00Z']) {
    const db = database([], { forcedData: { id: 'synthetic-out-of-range', submitted_at } })
    const status = await getStrengthAssessmentStatus(db, client, now)
    assert.equal(status.state, 'due'); assert.equal(status.completedAt, null); db.verify()
  }
})

test('a completed baseline links directly to the now-restorable saved results', async () => {
  const db = database([assessment()]), status = await getStrengthAssessmentStatus(db, client, now)
  assert.equal(status.href, '/dashboard/assessment/start2?period=2026-10-01'); assert.equal(status.actionLabel, 'View Saved Results')
  assert.match(getStrengthAssessmentDetail(status, client), /Completed October 16, 2026/)
  assert.match(getStrengthAssessmentDetail(status, client), /Saved results are available/)
  db.verify()
})

test('unavailable status opens the loader to retry before any repeat submission', async () => {
  const db = database([], { fail: true }), status = await getStrengthAssessmentStatus(db, client, now)
  assert.equal(status.href, '/dashboard/assessment/start2?period=2026-10-01'); assert.equal(status.actionLabel, 'Retry Loading Assessment')
  assert.match(getStrengthAssessmentDetail(status, client), /Open the assessment to retry.*before submitting again/)
  db.verify()
})

const draft = (changes={}) => ({client_id:client.client_id,auth_user_id:client.auth_user_id,period:'2026-10-01',status:'draft',saved_at:'2026-10-16T16:00:00Z',completed_at:null,assessment_id:null,...changes})
test('owned current drafts resume with their saved timestamp and older drafts remain separate',async()=>{
  const db=database([],{sessions:[draft(),draft({period:'2026-09-01',saved_at:'2026-09-20T16:00:00Z'}),draft({period:'2026-08-01',saved_at:'2026-08-20T16:00:00Z'}),draft({auth_user_id:'other-owner',period:'2026-09-01',saved_at:'2026-10-15T16:00:00Z'})]})
  const status=await getStrengthAssessmentStatus(db,client,now)
  assert.equal(status.state,'draft');assert.equal(status.actionLabel,'Resume Assessment');assert.equal(status.savedAt,'2026-10-16T16:00:00Z')
  assert.deepEqual(status.previousDraft,{period:'2026-09-01',savedAt:'2026-09-20T16:00:00Z',href:'/dashboard/assessment/start2?period=2026-09-01'})
  db.verify()
})
test('known owned final recognition survives draft outage and never becomes a writable draft',async()=>{
  const db=database([assessment()],{failSessions:true})
  const status=await getStrengthAssessmentStatus(db,client,now)
  assert.equal(status.state,'completed');assert.equal(status.unavailable,false);assert.equal(status.actionLabel,'View Saved Results');db.verify()
  const unavailable=database([],{failSessions:true})
  assert.equal((await getStrengthAssessmentStatus(unavailable,client,now)).state,'unavailable');unavailable.verify()
})
test('period-bound completion, foreign drafts and future session metadata cannot complete another month',async()=>{
  const db=database([assessment({assessment_period:'2026-09-01'})],{sessions:[draft({auth_user_id:'foreign'}),draft({status:'completed',completed_at:'2026-11-01T12:00:00Z',assessment_id:'future'}),draft({period:'2026-09-01',saved_at:'2027-01-01T12:00:00Z'})]})
  const status=await getStrengthAssessmentStatus(db,client,now)
  assert.equal(status.state,'due');assert.equal(status.completedAt,null);assert.equal(status.previousDraft,null);db.verify()
})

for (const path of ['components/program-dashboard/TierAwareDashboardWorkspace.tsx', 'components/workout-dashboard/WorkoutDashboard.tsx']) {
  test(`${path} strength card uses its own recognition instead of the monthly check-in count`, () => {
    const source = readFileSync(path, 'utf8')
    assert.match(source, /logic\.assessments\.strength/)
    assert.match(source, /\{strength(?:Assessment)?\.label\}/)
    assert.match(source, /href=\{strength(?:Assessment)?\.href\}/)
    assert.doesNotMatch(source, /monthlyDueCount\s*\?\s*['"]Due['"]\s*:\s*['"]Current['"]/)
    assert.doesNotMatch(source, /View Saved Results/)
  })
}

test('dashboard loader and engine carry the independent recognition and fail closed when omitted', () => {
  const loader = readFileSync('lib/dashboard/logic/loadProgramLogicInputs.ts', 'utf8')
  const engine = readFileSync('lib/dashboard/logic/getProgramLogicEngine.ts', 'utf8')
  assert.match(loader, /getStrengthAssessmentStatus\(supabase,\s*client\)/)
  assert.match(loader, /\bstrengthAssessment\b/)
  assert.match(engine, /strength:\s*inputs\.strengthAssessment\s*\|\|\s*strengthAssessmentStatusFromRecords/)
  assert.match(engine, /period:\s*getStrengthAssessmentPeriod\(inputs\.client\),\s*unavailable:\s*true/)
})
