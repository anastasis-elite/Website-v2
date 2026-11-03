import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const { rebuildDailyHealthMetrics } = await importTs('lib/health/service.ts')
const { normalizeHealthSample } = await importTs('lib/health/normalize.ts')
const { HEALTH_PROVIDERS, HEALTH_METRIC_TYPES } = await importTs('lib/health/types.ts')
const { capabilityForPath, isProtectedApiPath } = await importTs('lib/membership/policy.ts')
const read = path => readFileSync(path, 'utf8')
const baselineHashes = {
  'app/api/mobile/health/sync/route.ts': '749d0e20274b288bbee042af09992c5568bfd81d5d6c3607d37138bda5b7b744',
  'lib/dashboard/logic/getProgramLogicEngine.ts': '252ba497a1f5a8ad6ba1980dfeefaad43373a1c0a76d887388a70ee037b1ab6a',
  'lib/dashboard/logic/loadProgramLogicInputs.ts': '02c003cbbd97d5564d8973ded5f41e7aaf05dd7ed6358d1e99e801e39af17c68',
  'lib/health/aggregate.ts': '3339931c80e7c149d423caa52439bf75f93640e58533c063f7a9d547678b5bf3',
  'lib/health/normalize.ts': 'ec986ffa93a4a38c6d339f4facd8840a6face58c959e7e9f5af4f62cf245dcca',
  'lib/health/provenance.ts': '0898e34e4d88fb769a36ce89ef5d827472466f2b7f27400a465b192519fb7d4a',
  'lib/health/providerNormalizers.ts': 'd5a36864c5201bacbda44afe532b3de0fdde50d71b7367331aa4d771ea63e767',
  'lib/health/service.ts': '7628a7d99e40918d0a8ec94da3d27dd1ec2a2b49ea433b83346063ebbeda89bb',
  'lib/health/types.ts': '2d24bb4836ad37edef73dc5457e9ce2d0a6179e22f1729ce3b7c312c5e77c093',
  'lib/nutrition/targetService.ts': 'f36f991df4dfd7fdbc2f26e3a65bf873c3b3b85781a3476419cc63ef4e8954a7',
}

function calls(path) {
  const file = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const result = []
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression
      const method = ts.isPropertyAccessExpression(expression) ? expression.name.text
        : ts.isIdentifier(expression) ? expression.text : ''
      const receiver = ts.isPropertyAccessExpression(expression) ? expression.expression.getText(file) : ''
      const first = node.arguments[0]
      const literal = first && (ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first)) ? first.text
        : first && ts.isTemplateExpression(first) ? first.head.text : null
      const options = node.arguments[1]
      const body = options && ts.isObjectLiteralExpression(options) ? options.properties.find(property =>
        ts.isPropertyAssignment(property) && property.name.getText(file) === 'body') : null
      result.push({ method, receiver, literal, source: node.getText(file), body: body?.initializer.getText(file) || null })
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return result
}

test('the existing native health, nutrition, recovery and streak input paths remain byte-identical and cannot read the review partition', () => {
  for (const [path, expected] of Object.entries(baselineHashes)) {
    assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), expected, `${path} changed from the reviewed implementation baseline`)
    assert.doesNotMatch(read(path), /health_export_review|apple_health_export/)
  }
  const nativeTables = calls('lib/health/service.ts').filter(call => call.method === 'from' && call.receiver === 'supabase').map(call => call.literal)
  assert.ok(nativeTables.includes('health_samples'))
  assert.ok(nativeTables.includes('daily_health_metrics'))
  assert.ok(nativeTables.includes('health_integrations'))
  assert.ok(nativeTables.every(table => ['health_samples', 'daily_health_metrics', 'health_integrations'].includes(table)))
  assert.ok(calls('lib/dashboard/logic/loadProgramLogicInputs.ts').some(call => call.method === 'from' && call.literal === 'daily_health_metrics'))
  assert.ok(calls('lib/nutrition/targetService.ts').some(call => call.method === 'table' && call.source.includes("'daily_health_metrics'")))
})

test('actual native daily aggregation ignores separately stored imported resting and raw heart-rate samples', async () => {
  const native = [60, 64].map((value, index) => ({ provider: index ? 'health_connect' : 'apple_health',
    metric_type: 'resting_heart_rate', value, unit: 'count/min', start_at: '2026-11-02T12:00:00.000Z', end_at: '2026-11-02T12:00:00.000Z' }))
  const reviews = [{ provider: 'apple_health_export', metric_type: 'resting_heart_rate', value: 99, review_only: true },
    { provider: 'apple_health_export', metric_type: 'heart_rate', value: 120, review_only: true }]
  async function rebuild(reviewRows) {
    const touched = [], writes = [], tables = { health_samples: native, health_export_review_samples: reviewRows,
      health_integrations: [{ provider: 'apple_health', connection_status: 'disconnected', provider_sync_state: { cursor: 'unchanged' } }] }
    const before = structuredClone(tables)
    const supabase = { from(table) {
      touched.push(table)
      const query = { select() { return query }, eq() { return query }, gte() { return query }, lt() { return query },
        then(resolve) { return Promise.resolve({ data: structuredClone(tables[table] || []), error: null }).then(resolve) },
        async upsert(rows) { writes.push({ table, rows: structuredClone(rows) }); return { error: null } } }
      return query
    } }
    await rebuildDailyHealthMetrics({ supabase, userId: 'synthetic-owner', client: { client_id: 'SYNTHETIC', timezone: 'UTC' }, dates: ['2026-11-02'] })
    assert.deepEqual(tables, before, 'Native integration state and both source partitions are not mutated by aggregation')
    assert.deepEqual(touched, ['health_samples', 'daily_health_metrics'])
    assert.equal(writes.length, 1)
    assert.equal(writes[0].table, 'daily_health_metrics')
    return writes[0].rows.map(({ computed_at, updated_at, ...metric }) => metric)
  }
  const baseline = await rebuild([]), after = await rebuild(reviews)
  assert.deepEqual(after, baseline)
  assert.equal(after.length, 1)
  assert.equal(after[0].metric_type, 'resting_heart_rate')
  assert.equal(after[0].value, 62)
  assert.equal(after[0].sample_count, 2)
  assert.deepEqual(after[0].source_providers, ['apple_health', 'health_connect'])
})

test('the import API and prepared SQL can persist only fixed review records, without a native identity or aggregate bridge', () => {
  const route = 'app/api/health/apple-export/route.ts'
  for (const method of ['GET', 'POST']) assert.equal(capabilityForPath('/api/health/apple-export', method), 'healthRecords')
  assert.equal(isProtectedApiPath('/api/health/apple-export'), true)
  const middleware = ts.createSourceFile('middleware.ts', read('middleware.ts'), ts.ScriptTarget.Latest, true)
  let matchers = null
  function findMatchers(node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(middleware) === 'matcher' && ts.isArrayLiteralExpression(node.initializer)) {
      matchers = node.initializer.elements.map(element => ts.isStringLiteral(element) ? element.text : null)
    }
    ts.forEachChild(node, findMatchers)
  }
  findMatchers(middleware)
  assert.ok(matchers?.includes('/api/health/:path*'), 'Middleware must execute the health-record capability gate for the importer')
  const routeCalls = calls(route)
  assert.deepEqual(routeCalls.filter(call => call.method === 'from').map(call => call.literal), ['clients'])
  assert.deepEqual(routeCalls.filter(call => call.method === 'rpc').map(call => call.literal),
    ['import_health_export_review_batch', 'get_health_export_review_day'])
  assert.doesNotMatch(read(route), /completeHealthSync|upsertHealthIntegration|rebuildDailyHealthMetrics|aggregateHealthSamplesForDay|createAdminClient|invalidateDailyPlan/)
  const sql = read('docs/sql/apple-health-export-review.sql').replace(/--[^\n]*/g, '')
  assert.doesNotMatch(sql, /\b(?:health_samples|daily_health_metrics|health_integrations|daily_execution_status|recovery_activity_logs|recovery_logs)\b/i)
  assert.deepEqual([...sql.matchAll(/\bcreate\s+table\s+((?:public|health_export_private)\.\w+)/gi)].map(match => match[1]).sort(),
    ['health_export_private.review_batches', 'public.health_export_review_samples'])
  assert.deepEqual([...sql.matchAll(/\binsert\s+into\s+((?:public|health_export_private)\.\w+)/gi)].map(match => match[1]).sort(),
    ['health_export_private.review_batches', 'public.health_export_review_samples'])
  const receiptTable = /create table health_export_private\.review_batches\s*\(([\s\S]*?)\n\);/i.exec(sql)?.[1]
  assert.ok(receiptTable, 'Batch outcomes have a separate private metadata table')
  assert.doesNotMatch(receiptTable, /\b(?:jsonb?|value|metric_type|source_name|source_device|records)\b/i, 'Persisted confirmation receipts must not copy raw records or measurement values')
  assert.match(sql, /provider\s*=\s*'apple_health_export'/)
  assert.match(sql, /review_only\s+boolean\s+not\s+null\s+default\s+true\s+check\(review_only\)/i)
  assert.match(sql, /Apple Health export; user imported/)
  assert.deepEqual(HEALTH_PROVIDERS, ['apple_health', 'health_connect'])
  assert.equal(HEALTH_METRIC_TYPES.includes('heart_rate'), false)
  assert.throws(() => normalizeHealthSample({ provider: 'apple_health_export', metric_type: 'resting_heart_rate', value: 60,
    unit: 'count/min', start_at: '2026-11-02T12:00:00Z', end_at: '2026-11-02T12:00:00Z' }), /Unsupported health provider/)
})

test('the browser import path has no raw archive upload, persistent health storage, analytics or logging escape', () => {
  const paths = ['components/account/AppleHealthExportImport.tsx', 'lib/health/appleExport/parser.worker.ts',
    'lib/health/appleExport/parser.ts', 'lib/health/appleExport/xml.ts', 'lib/health/appleExport/zip.ts', 'lib/health/appleExport/shared.ts']
  for (const path of paths) {
    const source = read(path), invoked = calls(path)
    assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|createAdminClient/)
    for (const call of invoked) {
      assert.ok(!['setItem', 'openDatabase', 'sendBeacon', 'trackEvent', 'capture', 'rpc'].includes(call.method), `${path}: unexpected persistence/telemetry call ${call.method}`)
      assert.ok(call.method !== 'from' || call.receiver === 'Array', `${path}: unexpected browser database query`)
      assert.ok(!/indexedDB|localStorage|sessionStorage|caches/.test(call.receiver), `${path}: browser persistence must not receive health data`)
      assert.ok(call.receiver !== 'console', `${path}: health path must not log values or errors`)
      if (call.method === 'fetch') {
        assert.equal(path, 'components/account/AppleHealthExportImport.tsx')
        assert.ok(call.literal?.startsWith('/api/health/apple-export'), 'The only browser request destination is the normalized review endpoint')
        if (call.body) assert.doesNotMatch(call.body, /\b(?:file|archive|blob|xml|arrayBuffer)\b/i, 'A File/Blob/XML payload must never become a request body')
      }
    }
    assert.doesNotMatch(source, /\bnew\s+(?:FormData|XMLHttpRequest|WebSocket)\b/)
  }
  const ui = read(paths[0])
  assert.match(ui, /ph-no-capture ph-sensitive/)
  assert.match(ui, /Confirm and import previewed readings/)
  assert.match(ui, /Native and export readings can overlap without a reliable shared record identity/)
})
