import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const source = path => readFileSync(path, 'utf8')
const sha256 = value => createHash('sha256').update(value).digest('hex')
const baselineHashes = {
  "app/health-disclaimer/page.tsx": "ec461890dfafeb774726c2b92522210b324f6a16e3d34c6880fa15ca63385604",
  "lib/email/applicationConfirmationEmail.ts": "ad9f968b75be50e6da9344e5adcf7a6f912c7c9b186f011723bdcc5a1e9c969c",
  "app/api/admin/gift-client/route.ts": "979775d4020804fe9b4b6fa177fba1027f5d6d1dea0f98cb01ac9b0c7d95a429",
  "app/incident-response/page.tsx": "8cd7158710c58fc604ae88a8dac4b2c4dcc8c630d4f77509c6511b31f9f8a9a6",
  "app/aos/page.tsx": "198e2e47dd78d59057b849d614f8ffdcb6f165b5bd902ad06fff2505f87723fa",
  "app/api/marketing/generate/route.ts": "8d090bcbd5a1ec13d0c0d68b84b49556adde80d529a1063b67a8701d26eab456"
}
const protectedSections = {
  "terms": {
    "Scope of service": "c029631e279e76604422658fa175948b57cb0df9457b53579cf7c6240728fd46",
    "Not medical or emergency care": "3bb4edea80a5710b0f87b20c1d6511e1b0f70282ddc4dbbe2a282ce37de2b7ca",
    "Responsibility and assumption of risk": "672ec1f3bfdd1a9133c1824b9817fd7ec2d6d1c0773094211be0c69723eed29f",
    "Contraindications and stopping exercise": "4d084c7bfab027a4d27b1e14e22c13fd5bffd520c0063169409c3a21e18b0fcf",
    "Billing, renewal, cancellation, and refunds": "654466ebe31e8bb4137c9c8a6b0e218510a7c5908448138ba63933faa8c0fa05",
    "Data collection and research": "e6b35421d3eecb340d9398255b8c288aedf4e7ce9426cc2c23ea5a3fb1fffd73",
    "Changes and revision history": "919be6bbe1b5e874e7e3049aef0e4633c398125ea9d89d2edd29bac4fa632e88",
    "Contact": "7673f64c5dfa8ed71532e45459dc57fc86049f0b7afe393e8242a29a78f58ec3"
  },
  "privacy": {
    "Information collected": "ef3a667baa656f024533a0ce185046d936dfe7164e197f8ea34c075cc81f30a8",
    "Why we collect it": "1d0c9d3c321c986b2134f00fb98e38869284100f3e47253dd6adaa52052b2a54",
    "How information is used": "9a84d8a3f12e1b5911e486a6b86e0e3f0e30037f9cc4164ae3f7a9a45251b0c5",
    "Vendors and subprocessors": "6f0d5e71864c4f3c3001a32506aa1cfbe1b219b3661ab4517ec2218d8ae780e8",
    "Retention and deletion": "72c323db05041bd66762ba557fc688634ad5fc9a0ed3055ae5f02ec9edbf5eea",
    "Your rights and choices": "4a01906a8ebc4c2675a30200d3d36cae1e6702d47b5b87adead950e1dbb1b01f",
    "Security": "44862785b04f6f7f510bbd3277d154cc70f13da2b277c13ef4de8ed3af918a15",
    "Incidents and breach notification": "f246b419553feb1b85ec38c8f77232c081c21b8cc8e4586a554e947e1507260a",
    "Version and contact": "a9a4d644befa4a94aa403af350f2763de088fd0e502e14f017c25a190792dd77"
  }
}
const modules = new Map()
let permanentTarget
function load(path) {
  if (modules.has(path)) return modules.get(path).exports
  const module = { exports: {} };modules.set(path, module)
  const compiled = ts.transpileModule(source(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  runInNewContext(compiled, { module, exports: module.exports, Date, require(name) {
    if (name === 'next/link') return { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) }
    if (name === 'next/navigation') return { permanentRedirect(target) { permanentTarget = target;throw new Error('synthetic permanent redirect') } }
    if (name === '@/app/styles/globalstyles') return {}
    if (name === '@/lib/seo') return { absoluteUrl: path => `https://example.test${path}` }
    if (name.startsWith('@/')) {
      const local = name.slice(2)
      return load(existsSync(`${local}.tsx`) ? `${local}.tsx` : `${local}.ts`)
    }
    return require(name)
  } }, { filename: path })
  return module.exports
}
const render = (path, props) => renderToStaticMarkup(React.createElement(load(path).default, props))
const sections = text => new Map([...text.matchAll(/<LegalSection title="([^"]+)">([\s\S]*?)<\/LegalSection>/g)].map(match => [match[1], match[2]]))
// The approved November revision changes only these two revision-date notices;
// restore their exact prior text for the unchanged-protections comparison.
const priorRevisionNotice = text => text
  .replace('Revised and effective {TERMS_EFFECTIVE_DATE}.', 'Initial launch draft effective July 1, 2026.')
  .replace('revised and effective {PRIVACY_EFFECTIVE_DATE}.', 'initial launch draft effective July 1, 2026.')
const misleading = /\bAI\b|AI-assisted|AI-driven|AI-powered|no AI|model-free|photos never leave/i

test('the retired document uses a deliberate permanent redirect to the existing health protections', () => {
  permanentTarget = undefined
  assert.throws(() => load('app/ai-disclaimer/page.tsx').default(), /synthetic permanent redirect/)
  assert.equal(permanentTarget, '/health-disclaimer')
  assert.equal(sha256(source('app/health-disclaimer/page.tsx')), baselineHashes['app/health-disclaimer/page.tsx'])
})

test('Terms and Privacy retire broad claims while preserving every other legal section and factual manual-photo protections', () => {
  const terms = sections(source('app/terms/page.tsx'))
  for (const [title, digest] of Object.entries(protectedSections.terms)) assert.equal(sha256(priorRevisionNotice(terms.get(title))), digest, title)
  assert.equal(terms.size, 9)
  assert.equal(terms.has('AI-assisted recommendations'), false)
  const privacy = sections(source('app/privacy/page.tsx'))
  for (const [title, digest] of Object.entries(protectedSections.privacy)) assert.equal(sha256(priorRevisionNotice(privacy.get(title))), digest, title)
  assert.equal(privacy.size, 10)
  const html = render('app/privacy/page.tsx')
  assert.match(html, /assessment photos and the landmarks you place, review, and confirm may be saved with your assessment/)
  assert.match(html, /Photo quality and point placement can affect the usefulness of those records/)
  assert.match(html, /not medical diagnoses/)
  assert.match(html, /limited to intended service purposes and subject to access controls and vendor terms/)
  assert.match(html, /Withdrawing optional research consent does not terminate program access/)
  assert.doesNotMatch(html, misleading)
  assert.doesNotMatch(html, /browser model|pose-detection model|measurements shown|new analysis|new report/i)
  const renderedTerms = render('app/terms/page.tsx')
  assert.match(renderedTerms, /structured coaching formulations/)
  assert.match(renderedTerms, /do not diagnose conditions or replace medical or emergency care/)
  assert.match(renderedTerms, /Call 911 or your local emergency number/)
  assert.match(renderedTerms, /href="\/research-consent"/)
  assert.doesNotMatch(renderedTerms, misleading)
})

test('both Daily Insight presentations retain their content and health notice without a retired panel or absence claim', () => {
  for (const compact of [false, true]) {
    const html = render('components/DailyInsightCard.tsx', { compact, insight: { observation: 'Saved observation', nextStep: 'Saved next step' } })
    assert.match(html, /Saved observation/);assert.match(html, /Saved next step/)
    assert.match(html, /consult qualified professionals when appropriate/)
    assert.match(html, /do not diagnose conditions or replace medical or emergency care/)
    assert.match(html, /href="\/health-disclaimer"/)
    assert.doesNotMatch(html, misleading)
    assert.doesNotMatch(html, /\/ai-disclaimer/)
  }
  assert.equal(render('components/DailyInsightCard.tsx', { insight: {} }), '')
})

test('the footer remains with every other destination and the retired URL is removed from the sitemap', () => {
  const html = render('components/LegalFooter.tsx')
  assert.match(html, /<footer class="legal-footer">/)
  assert.deepEqual([...html.matchAll(/<a href="([^"]+)">/g)].map(match => match[1]), [
    '/what-is-anastasis', '/program', '/about', '/terms', '/privacy', '/health-disclaimer', '/refund-policy', '/research-consent', '/support',
  ])
  const map = load('app/sitemap.ts').default()
  const paths = Array.from(map, item => new URL(item.url).pathname)
  assert.deepEqual(paths, ['/', '/what-is-anastasis', '/about', '/why', '/program', '/program/ember', '/program/ignite', '/program/phoenix', '/audit', '/terms', '/privacy', '/health-disclaimer', '/refund-policy', '/research-consent', '/conditions'])
  assert.doesNotMatch(html, misleading)
})

test('future confirmation and gift templates only drop the obsolete link without sending or changing membership behavior', () => {
  const applicationPath = 'lib/email/applicationConfirmationEmail.ts'
  const restoredApplication = source(applicationPath).replace('Research & Data Consent:', 'AI Disclaimer:\nhttps://anastasiselite.com/ai-disclaimer\n\nResearch & Data Consent:')
  assert.equal(sha256(restoredApplication), baselineHashes[applicationPath])
  const email = load(applicationPath).buildApplicationConfirmationEmail({ fullName: 'Synthetic member' })
  assert.match(email.text, /Hi Synthetic member/)
  for (const route of ['/terms', '/health-disclaimer', '/conditions', '/consent/research']) assert.ok(email.text.includes(route))
  assert.doesNotMatch(email.text, misleading)
  const giftPath = 'app/api/admin/gift-client/route.ts'
  const restoredGift = source(giftPath).replace('      healthDisclaimer: `${appUrl}/health-disclaimer`,\n', '      healthDisclaimer: `${appUrl}/health-disclaimer`,\n      aiDisclaimer: `${appUrl}/ai-disclaimer`,\n')
    .replace('          <li><a href="${termsLinks.healthDisclaimer}">Health Disclaimer</a></li>\n', '          <li><a href="${termsLinks.healthDisclaimer}">Health Disclaimer</a></li>\n          <li><a href="${termsLinks.aiDisclaimer}">AI Disclaimer</a></li>\n')
  assert.equal(sha256(restoredGift), baselineHashes[giftPath], 'No gift handler, payment, invitation or send behavior was executed or edited.')
})

test('remaining visible placeholder cleanup is text-only and the obsolete shared panel has no runtime surface', () => {
  const incident = 'app/incident-response/page.tsx'
  assert.equal(sha256(source(incident).replace('email, analytics, and storage providers', 'email, analytics, AI, and storage providers')), baselineHashes[incident])
  const aos = 'app/aos/page.tsx'
  assert.equal(sha256(source(aos).replace('Automation systems, workflows, and future operational support.', 'Automation systems, workflows, and future AI employees.')), baselineHashes[aos])
  const marketing = 'app/api/marketing/generate/route.ts'
  const restoredMarketing = source(marketing).replace('// Temporary placeholder for the publishing workflow.', '// Temporary placeholder until AI call is connected.')
    .replace('Connect this route to your publishing workflow and return the prepared content here.', 'Connect this route to your AI provider and return the model response here.')
  assert.equal(sha256(restoredMarketing), baselineHashes[marketing])
  assert.equal(existsSync('components/legal/AIDisclaimer.tsx'), false)
  for (const path of ['app/terms/page.tsx', 'app/privacy/page.tsx', 'components/DailyInsightCard.tsx', 'components/LegalFooter.tsx', incident, aos, marketing]) {
    assert.doesNotMatch(source(path), /AIDisclaimer|\/ai-disclaimer|\bAI\b/)
  }
})
