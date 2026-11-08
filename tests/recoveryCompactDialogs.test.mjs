import CardArtworkModule from './cardArtworkFixture.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const text = node => typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(text).join(' ') : node && typeof node === 'object' ? text(node.props?.children) : ''
const nodes = (tree, predicate) => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(child => nodes(child, predicate)) : [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]

function harness() {
  const states = [], refs = [];let stateIndex = 0, refIndex = 0, focusReturns = 0
  const module = { exports: {} }
  const mocks = {
    react: { useId: () => 'guided-practice', useRef(initial) { return refs[refIndex++] ||= { current: initial } },
      useState(initial) { const index = stateIndex++;if (!(index in states)) states[index] = initial;return [states[index], value => { states[index] = value }] } },
    '@/components/CardArtwork': CardArtworkModule,
    '@/components/RecoveryLogger': {}, '@/components/recovery/RecoveryActivitySheets': {}, '@/lib/recovery/activityDisplay': {},
    '@/components/DailyCheckInForm': {}, '@/components/recovery/BreathingReset': {}, '@/lib/dashboard/dailyTraining': {},
    '@/lib/recovery/scoreExplanation': {}, '@/components/dashboard/useViewPreference': {},
    '@/components/ActionArrow': { __esModule: true, default: 'arrow' }, './RecoveryCards.module.css': { card: 'compact-card', copy: 'compact-copy', title: 'compact-title', arrow: 'compact-arrow', dialog: 'compact-dialog' },
    'next/link': { __esModule: true, default: 'a' },
  }
  const compiled = ts.transpileModule(readFileSync('components/recovery/RecoveryDashboardClient.tsx', 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  runInNewContext(compiled, { module, exports: module.exports, require: name => mocks[name] || require(name) })
  let dialogNode
  const nativeDialog = { open: false, showModal() { this.open = true }, close() { this.open = false;dialogNode.props.onClose() } }
  const render = () => { stateIndex = refIndex = 0;const tree = module.exports.GuidedRecoveryCards();dialogNode = nodes(tree, node => node.type === 'dialog')[0];dialogNode.ref.current = nativeDialog;return tree }
  const open = title => { const button = nodes(render(), node => node.type === 'button' && node.props['aria-label'] === `View ${title} details`)[0];button.props.onClick({ currentTarget: { focus() { focusReturns++ } } });render() }
  return { render, open, nativeDialog, get dialog() { render();return dialogNode }, get focusReturns() { return focusReturns } }
}

test('guided Recovery cards are arrow-free native buttons with titles beneath artwork and dialog focus return', () => {
  const view = harness(), cards = nodes(view.render(), node => node.type === 'button' && node.props.className === 'compact-card')
  assert.equal(cards.length, 5)
  const artworkKinds = ['meditation', 'yoga-nidra', 'mobility', 'yogic-practices', 'breathwork']
  for (const [index, card] of cards.entries()) {
    const artwork = nodes(card, node => node.type === CardArtworkModule.default)
    assert.equal(artwork.length, 1)
    const image = CardArtworkModule.default(artwork[0].props)
    assert.equal(image.type, 'img')
    assert.equal(image.props.alt, '')
    assert.equal(image.props.src, `/_next/static/media/${artworkKinds[index]}-640.webp`)
    assert.equal(nodes(card, node => node.type === 'span' && node.props.className === 'compact-title').length, 1)
    const children = card.props.children.flat(Infinity).filter(Boolean)
    assert.equal(children.length, 2)
    assert.equal(children[0], artwork[0], 'Artwork comes before the title block in document order.')
    assert.equal(children[1].props.className, 'compact-copy')
    assert.equal(nodes(children[1], node => node.props?.className === 'compact-title').length, 1)
    assert.equal(nodes(card, node => node.type === 'arrow' || node.type === 'svg').length, 0, 'Card-only arrows are absent.')
    assert.equal(nodes(card, node => node.type === 'p').length, 0)
    assert.equal(nodes(card, node => node.type === 'button').length, 1, 'The native tile is the only button; controls are not nested.')
    assert.equal(nodes(card, node => node.type === 'a').length, 0)
    const trigger = card
    assert.equal(trigger.props.type, 'button')
    assert.equal(trigger.props['aria-haspopup'], 'dialog');assert.equal(trigger.props['aria-controls'], 'guided-practice')
  }
  view.open('Meditation')
  assert.equal(view.nativeDialog.open, true)
  assert.equal(view.dialog.props['aria-labelledby'], 'guided-practice-title')
  assert.equal(view.dialog.props['aria-describedby'], 'guided-practice-description')
  assert.match(text(view.dialog), /silent meditation timer/)
  assert.equal(nodes(view.dialog, node => node.type === 'a')[0].props.href, '/dashboard/meditation?practice=recovery-meditation')
  assert.equal(nodes(view.dialog, node => node.type === 'arrow').length, 1, 'The existing timer-link arrow remains inside the dialog.')
  nodes(view.dialog, node => node.type === 'button' && text(node) === 'Close')[0].props.onClick()
  assert.equal(view.nativeDialog.open, false);assert.equal(view.focusReturns, 1)
  view.open('Breathwork')
  assert.equal(nodes(view.dialog, node => node.type === 'a')[0].props.href, '/dashboard/meditation?practice=breath-reset')
  assert.equal(nodes(view.dialog, node => node.type === 'arrow').length, 1)
  view.nativeDialog.close()
  assert.equal(view.focusReturns, 2)
})

test('unavailable guided recordings stay unavailable inside descriptions and offer only the existing own-practice route', () => {
  const view = harness()
  for (const title of ['Yoga nidra', 'Guided mobility', 'Yogic practices']) {
    view.open(title)
    assert.match(text(view.dialog), /not available here/)
    assert.equal(nodes(view.dialog, node => node.props.role === 'status').length, 1)
    assert.deepEqual(nodes(view.dialog, node => node.type === 'a').map(node => node.props.href), ['#own-practice'])
    assert.equal(nodes(view.dialog, node => node.type === 'audio').length, 0)
    assert.doesNotMatch(text(view.dialog), /play recording|start guided session/i)
    nodes(view.dialog, node => node.type === 'a')[0].props.onClick()
    assert.equal(view.nativeDialog.open, false)
  }
  assert.equal(view.focusReturns, 3)
})

test('Recovery square artwork is full-width and scoped while responsive cards retain dialog descriptions', () => {
  const source = readFileSync('components/recovery/RecoveryDashboardClient.tsx', 'utf8')
  const css = readFileSync('components/recovery/RecoveryCards.module.css', 'utf8')
  assert.match(source, /<GuidedRecoveryCards \/>/)
  assert.match(source, /<RecoveryActivitySheets clientId=\{clientId\} \/>/)
  assert.doesNotMatch(source, /<PhoneAppCard\b/)
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(css, /max-width: 640px[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(css, /min-height: 44px/)
  assert.match(css, /\.card:focus-visible/)
  const cardRule = css.match(/\.card\s*\{([^}]+)\}/)?.[1]
  assert.ok(cardRule)
  assert.match(cardRule, /display: flex/)
  assert.match(cardRule, /flex-direction: column/)
  const imageRule = css.match(/\.card\s*>\s*img\s*\{([^}]+)\}/)?.[1]
  assert.ok(imageRule, 'Square image sizing stays local to Recovery card images.')
  assert.match(imageRule, /width:\s*100%/)
  assert.match(imageRule, /height:\s*auto/)
  assert.match(imageRule, /aspect-ratio:\s*1\s*\/\s*1/)
  assert.match(imageRule, /object-fit:\s*cover/)
  assert.doesNotMatch(css, /height:\s*(?:88|108)px/)
  assert.match(css, /max-height: calc\(100dvh - 32px\); overflow: auto/)
  assert.doesNotMatch(css, /:global|animation|position: fixed/)
})
