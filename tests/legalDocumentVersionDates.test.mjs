import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require = createRequire(import.meta.url)
const modules = new Map()
function load(path) {
  if (modules.has(path)) return modules.get(path).exports
  const module = { exports: {} };modules.set(path, module)
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  runInNewContext(compiled, { module, exports: module.exports, require(name) {
    if (name === 'next/link') return { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) }
    if (name === '@/app/styles/globalstyles') return {}
    if (name.startsWith('@/')) {
      const stem = name.slice(2)
      return load(existsSync(`${stem}.tsx`) ? `${stem}.tsx` : `${stem}.ts`)
    }
    return require(name)
  } }, { filename: path })
  return module.exports
}
const render = path => renderToStaticMarkup(React.createElement(load(path).default)).replace(/<!-- -->/g, '')
const config = await importTs('lib/legal/config.ts')
const mocks = {
  'next/server': 'export const NextResponse = { json: (body, init) => Response.json(body, init) }',
  '@/lib/supabase/server': 'export const createClient = async () => globalThis.legalDatesRequestDb',
  '@/lib/supabase/admin': 'export const createAdminClient = () => globalThis.legalDatesPrivilegedDb',
}
const { hasCurrentLegalAcceptance } = await importTs('lib/legal/hasCurrentLegalAcceptance.ts', mocks)
const accept = await importTs('app/api/legal/accept/route.ts', mocks)
const owner = 'qa-document-dates-owner', clientId = 'QA-DOCUMENT-DATES'
const required = { terms: true, privacy: true, healthDisclaimer: true }
const request = body => new Request('https://example.test/api/legal/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

function fixture(initial = []) {
  const client = { client_id: clientId, auth_user_id: owner, program: 'ember' }
  globalThis.legalDatesRequestDb = {
    auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }) },
    from(table) {
      assert.equal(table, 'clients')
      const filters = [], query = {
        select() { return query }, eq(key, value) { filters.push([key, value]);return query },
        maybeSingle: async () => ({ data: filters.every(([key, value]) => client[key] === value) ? client : null, error: null }),
      }
      return query
    },
  }
  const tables = { legal_acceptances: structuredClone(initial), feature_consent_events: [] }, reads = [], writes = []
  globalThis.legalDatesPrivilegedDb = {
    from(table) {
      assert.ok(table in tables)
      const filters = [];let columns = '*', count = Infinity
      const query = {
        select(value) { columns = value;return query }, eq(key, value) { filters.push([key, value]);return query }, limit(value) { count = value;return query },
        maybeSingle: async () => {
          reads.push({ table, filters: structuredClone(filters) })
          const row = tables[table].filter(row => filters.every(([key, value]) => row[key] === value)).slice(0, count)[0]
          return { data: row ? Object.fromEntries(columns.split(',').map(key => [key, row[key]])) : null, error: null }
        },
        insert: async payload => {
          for (const row of Array.isArray(payload) ? payload : [payload]) {
            const stored = { id: `qa-version-${tables[table].length}`, ...structuredClone(row) };tables[table].push(stored);writes.push({ table, row: stored })
          }
          return { error: null }
        },
        update() { assert.fail('Version verification must never update history.') },
        delete() { assert.fail('Version verification must never delete history.') },
        upsert() { assert.fail('Version verification must never replace history.') },
      }
      return query
    },
  }
  return { tables, reads, writes, requestDb: globalThis.legalDatesRequestDb }
}
const accepted = (patch = {}) => ({ id: 'historical-owner', user_id: owner, terms_version: 'v1.0', privacy_version: 'v1.0',
  health_disclaimer_version: 'v1.0', ai_disclaimer_version: 'historical-accepted-version', research_consent_version: null, ...patch })

test('only revised Terms and Privacy publish v1.1 and November 2 while unchanged Health and Research retain July 1', () => {
  assert.equal(config.TERMS_VERSION, 'v1.1');assert.equal(config.PRIVACY_VERSION, 'v1.1')
  assert.equal(config.TERMS_EFFECTIVE_DATE, 'November 2, 2026');assert.equal(config.PRIVACY_EFFECTIVE_DATE, 'November 2, 2026')
  assert.equal(config.EFFECTIVE_DATE, 'July 1, 2026')
  for (const version of [config.HEALTH_DISCLAIMER_VERSION, config.RESEARCH_CONSENT_VERSION, config.FEATURE_CONSENT_VERSION]) assert.equal(version, 'v1.0')
  for (const path of ['app/terms/page.tsx', 'app/privacy/page.tsx']) {
    const html = render(path)
    assert.match(html, /Legal · v1\.1/)
    assert.match(html, /<strong>Effective date:<\/strong> November 2, 2026/)
    assert.match(html, /[Rr]evised and effective November 2, 2026/)
    assert.doesNotMatch(html, /initial launch draft|July 1, 2026/i)
  }
  for (const path of ['app/health-disclaimer/page.tsx', 'app/research-consent/page.tsx']) {
    const html = render(path)
    assert.match(html, /Legal · v1\.0/)
    assert.match(html, /<strong>Effective date:<\/strong> July 1, 2026/)
    assert.doesNotMatch(html, /November 2, 2026|v1\.1/)
  }
})

test('current-version checks reject either old document and never rewrite the owner’s historical acceptance', async () => {
  for (const patch of [{}, { terms_version: 'v1.1' }, { privacy_version: 'v1.1' }, { terms_version: 'v1.1', privacy_version: 'v1.1', health_disclaimer_version: 'old-health' }]) {
    const historical = accepted(patch), otherOwner = accepted({ id: 'other-owner', user_id: 'other', terms_version: 'v1.1', privacy_version: 'v1.1' })
    const db = fixture([historical, otherOwner]), before = structuredClone(db.tables)
    assert.equal(await hasCurrentLegalAcceptance(db.requestDb, owner), false)
    assert.deepEqual(db.tables, before);assert.equal(db.writes.length, 0)
    assert.ok(db.reads.every(read => read.filters.some(([key, value]) => key === 'user_id' && value === owner)))
    assert.ok(db.reads.every(read => !read.filters.some(([key]) => key === 'ai_disclaimer_version')))
  }
})

test('future signup appends current server document versions and passes the same gate without changing prior records', async () => {
  const historical = accepted(), db = fixture([historical])
  const response = await accept.POST(request({ ...required, researchConsent: false, terms_version: 'v1.0', privacy_version: 'v1.0' }))
  assert.equal(response.status, 200)
  assert.deepEqual(db.tables.legal_acceptances[0], historical)
  assert.equal(db.tables.legal_acceptances.length, 2)
  const newest = db.tables.legal_acceptances[1]
  assert.equal(newest.terms_version, 'v1.1');assert.equal(newest.privacy_version, 'v1.1')
  assert.equal(newest.health_disclaimer_version, 'v1.0')
  assert.equal(newest.ai_disclaimer_version, null);assert.equal(newest.research_consent_version, null)
  assert.equal(db.tables.feature_consent_events.length, 0)
  const beforeCheck = structuredClone(db.tables)
  assert.equal(await hasCurrentLegalAcceptance(db.requestDb, owner), true)
  assert.deepEqual(db.tables, beforeCheck)
})

test('the revision does not bypass any remaining required acknowledgment or require optional research', async () => {
  for (const missing of ['terms', 'privacy', 'healthDisclaimer']) {
    const db = fixture([accepted()]), before = structuredClone(db.tables)
    const response = await accept.POST(request({ ...required, [missing]: false }))
    assert.equal(response.status, 400)
    assert.deepEqual(db.tables, before);assert.equal(db.writes.length, 0)
  }
  const db = fixture()
  assert.equal((await accept.POST(request(required))).status, 200)
  assert.equal(db.tables.legal_acceptances[0].research_consent_version, null)
})
