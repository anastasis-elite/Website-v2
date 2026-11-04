import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const require = createRequire(import.meta.url)
const policy = await importTs('lib/membership/policy.ts')
const owner = { id: 'synthetic-owner' }
const member = overrides => ({ client_id: 'synthetic-client', auth_user_id: owner.id,
  program: 'ember', access: true, active: true, membership_expires_at: '2099-01-01T00:00:00Z', ...overrides })

function fixture(client = member(), authError) {
  const reads = [], rendered = []
  const module = { exports: {} }
  const read = source => async args => { reads.push({ source, ...args }); return { source, range: args.range } }
  const view = name => props => { rendered.push({ name, ...props }); return React.createElement('section', null, name) }
  const mocks = {
    '@/lib/dashboard/getDashboardContext': { getDashboardContext: async () => {
      if (authError) throw authError
      return { user: owner, client, supabase: { synthetic: true } }
    } },
    '@/lib/membership/policy': policy,
    '@/lib/dashboard/progressOverview': { progressRange: value => ['4w', '12w', 'all'].includes(value) ? value : '4w', loadProgressOverview: read('overview') },
    '@/lib/dashboard/nutritionProgress': { loadNutritionProgress: read('nutrition') },
    '@/lib/dashboard/cycleProgress': { loadCycleProgress: read('cycle') },
    '@/lib/dashboard/recoveryProgressHistory': { loadRecoveryProgressSummary: read('recovery') },
    '@/components/program-dashboard/ProgressOverview': { __esModule: true, default: view('overview') },
    '@/components/program-dashboard/ProgressTrends': { NutritionProgressCard: view('nutrition'), CycleProgressCard: view('cycle') },
    '@/components/phone-app/PhoneAppFrame': { __esModule: true, default: ({ children }) => React.createElement('div', null, children) },
    'next/navigation': { notFound: () => { throw new Error('SYNTHETIC_NOT_FOUND') } },
  }
  const code = ts.transpileModule(readFileSync('app/dashboard/progress/page.tsx', 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  runInNewContext(code, { module, exports: module.exports, require: name => {
    if (mocks[name]) return mocks[name]
    if (name.endsWith('.css')) return { __esModule: true, default: { content: 'content', trends: 'trends' } }
    return require(name)
  } })
  return { page: module.exports.default, reads, rendered }
}

test('Progress sends the same owned member-local range to all services across current tiers', async () => {
  for (const program of ['ember', 'ignite', 'phoenix']) for (const range of ['4w', '12w', 'all']) {
    const f = fixture(member({ program }))
    const html = renderToStaticMarkup(await f.page({ searchParams: Promise.resolve({ range }) }))
    assert.equal(f.reads.length, 4)
    for (const read of f.reads) {
      assert.equal(read.range, range)
      assert.equal(read.client.auth_user_id, owner.id)
      assert.equal(read.source === 'overview' ? read.userId : read.user.id, owner.id)
    }
    assert.equal(f.rendered.find(item => item.name === 'overview').recovery.source, 'recovery')
    assert.doesNotMatch(html, /<details|<summary|Small steps|Assessments and requirements|Detailed trends/)
  }
})

test('authentication, ownership and membership fail before any Progress history read', async () => {
  const auth = fixture(member(), new Error('SYNTHETIC_AUTH_FAILURE'))
  await assert.rejects(auth.page({ searchParams: Promise.resolve({}) }), /SYNTHETIC_AUTH_FAILURE/)
  assert.equal(auth.reads.length, 0)
  for (const overrides of [{ auth_user_id: 'foreign' }, { program: 'free' }, { program: 'unknown' },
    { access: false }, { active: false }, { membership_expires_at: '2000-01-01T00:00:00Z' }]) {
    const f = fixture(member(overrides))
    await assert.rejects(f.page({ searchParams: Promise.resolve({}) }), /SYNTHETIC_NOT_FOUND/)
    assert.equal(f.reads.length, 0)
  }
})

test('removing overview disclosures preserves assessment, photo and existing history paths', () => {
  for (const path of ['app/dashboard/progress/strength/page.tsx', 'app/dashboard/progress/body/page.tsx',
    'app/dashboard/progress/recovery/page.tsx', 'app/dashboard/progress/consistency/page.tsx',
    'app/dashboard/assessment/start2/page.tsx', 'components/ProgressPhotoComparison.tsx',
    'components/program-dashboard/DashboardDetailPanels.tsx']) assert.ok(existsSync(path), path)
  const source = readFileSync('app/dashboard/progress/page.tsx', 'utf8')
  assert.doesNotMatch(source, /ProgressTab|AssessmentsTab|TrendsTab|<details/)
})
