import assert from 'node:assert/strict'

export const client = { client_id: 'SYNTHETIC-STRENGTH', auth_user_id: 'synthetic-owner', timezone: 'America/Chicago', program: 'ember', access: true, active: true, membership_expires_at: '2099-01-01T00:00:00Z', verified_purchase: true }
export const final = (submitted_at, extra = {}) => ({ id: `final-${submitted_at}`, client_id: client.client_id, auth_user_id: client.auth_user_id, assessment_type: 'strength', submitted_at, assessment_period: null, ...extra })
export const draft = (period, saved_at, extra = {}) => ({ period, saved_at, status: 'draft', client_id: client.client_id, auth_user_id: client.auth_user_id, ...extra })

// Synthetic metadata reader. A table/ownership/projection violation fails the
// test; no remote service, health answers or credentials are involved.
export function database({ assessments = [], sessions = [], workouts = [], fail = [], forcedFinal } = {}) {
  const tables = { assessments: structuredClone(assessments), strength_assessment_sessions: structuredClone(sessions), workout_logs: structuredClone(workouts) }
  const original = structuredClone(tables), reads = []
  const db = { reads, tables, from(table) {
    assert.ok(Object.hasOwn(tables, table), `Unexpected table ${table}`)
    let projection, ordering, maximum
    const filters = []
    const q = { select(columns) { projection = columns; return q },
      eq(key, value) { filters.push(['eq', key, value]); return q },
      lt(key, value) { filters.push(['lt', key, value]); return q },
      lte(key, value) { filters.push(['lte', key, value]); return q },
      gte(key, value) { filters.push(['gte', key, value]); return q },
      order(key, options) { ordering = [key, options?.ascending !== false]; return q },
      limit(value) { maximum = value; return q },
      maybeSingle: async () => result(true), then(resolve, reject) { return Promise.resolve().then(() => result(false)).then(resolve, reject) },
    }
    function result(single) {
      assert.ok(filters.some(([op, key, value]) => op === 'eq' && key === 'client_id' && value === client.client_id))
      assert.ok(filters.some(([op, key, value]) => op === 'eq' && key === 'auth_user_id' && value === client.auth_user_id))
      if (table === 'assessments') {
        assert.equal(projection, 'id,submitted_at,assessment_period')
        assert.ok(filters.some(([op,key,value]) => op === 'eq' && key === 'assessment_type' && value === 'strength'))
        assert.ok(filters.some(([op,key]) => op === 'lte' && key === 'submitted_at'))
        assert.deepEqual(ordering, ['submitted_at', false]); assert.equal(maximum, 1)
      } else if (table === 'strength_assessment_sessions') assert.ok(!projection.includes('values'))
      reads.push({ table, filters: structuredClone(filters), projection })
      if (fail.includes(table)) return { data: null, error: { message: 'Synthetic read failure' } }
      if (forcedFinal !== undefined && table === 'assessments') return { data: structuredClone(forcedFinal), error: null }
      let rows = tables[table].filter(row => filters.every(([op,key,value]) => {
        if (op === 'eq') return row[key] === value
        if (row[key] == null) return false
        const left = key.endsWith('_at') ? Date.parse(row[key]) : row[key]
        const right = key.endsWith('_at') ? Date.parse(value) : value
        return op === 'lt' ? left < right : op === 'lte' ? left <= right : left >= right
      }))
      if (ordering) { const [key, ascending] = ordering; rows.sort((a,b) => String(a[key]).localeCompare(String(b[key])) * (ascending ? 1 : -1)) }
      if (maximum) rows = rows.slice(0, maximum)
      const project = row => projection === '*' ? structuredClone(row) : Object.fromEntries(projection.split(',').map(key => [key, row[key]]))
      return { data: single ? rows[0] ? project(rows[0]) : null : rows.map(project), error: null }
    }
    return q
  }, verify() { assert.deepEqual(tables, original, 'Reading cadence must not rewrite history or drafts') } }
  return db
}
