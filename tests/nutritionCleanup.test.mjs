import CardArtworkModule from './cardArtworkFixture.mjs'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const nativeRequire = createRequire(import.meta.url)
function loader(mocks, environment) {
  const cache = new Map()
  function load(path) {
    path = resolve(path)
    if (cache.has(path)) return cache.get(path).exports
    const module = { exports: {} }
    cache.set(path, module)
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
    vm.runInNewContext(code, {
      module, exports: module.exports, console, Date, Error, Promise, process: { env: { NODE_ENV: 'test' } }, ...environment,
      require(specifier) {
        if (specifier in mocks) return mocks[specifier]
        if (specifier.startsWith('@/') || specifier.startsWith('.')) {
          const base = specifier.startsWith('@/') ? resolve(specifier.slice(2)) : resolve(dirname(path), specifier)
          return load(base + (existsSync(base + '.tsx') ? '.tsx' : '.ts'))
        }
        return nativeRequire(specifier)
      },
    })
    return module.exports
  }
  return load
}

const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : !value || typeof value !== 'object' ? [] : [value, ...nodes(value.props?.children)]
const text = value => Array.isArray(value) ? value.map(text).join(' ') : value == null || typeof value === 'boolean' ? '' : typeof value !== 'object' ? String(value) : text(value.props?.children)
const node = (tree, predicate) => nodes(tree).find(predicate)
const button = (tree, label) => node(tree, value => value.type === 'button' && text(value).trim() === label)

function hooks() {
  const slots = [], effects = []; let cursor = 0
  const changed = (before, next) => !before || next.some((value, index) => value !== before[index])
  const react = {
    useId() { const index = cursor++; return slots[index] ||= `nutrition-${index}` },
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }] },
    useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial } },
    useMemo(callback, deps) { const index = cursor++; if (changed(slots[index]?.deps, deps)) slots[index] = { deps, value: callback() }; return slots[index].value },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps) },
    useEffect(callback, deps) { const index = cursor++; if (changed(slots[index]?.deps, deps)) { const old = slots[index]; const current = slots[index] = { deps }; effects.push(() => { old?.cleanup?.(); current.cleanup = callback() }) } },
  }
  return { react, render(Component, props, flush = true, attach = () => {}) { cursor = 0; const tree = Component(props); attach(tree); if (flush) for (const effect of effects.splice(0)) effect(); return tree } }
}

function fixture({ program = 'ember', persisted = {}, failRemaining = false, entries = [{ calories: 500, protein_g: 30, carbs_g: 50, fat_g: 15, day_block: 'midday' }] } = {}) {
  const state = hooks(), requests = [], reads = [], removals = []
  const values = new Map(Object.entries(persisted))
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => { removals.push(key); values.delete(key) } }
  const logDate = '2026-11-04'
  const log = { id: 'own-log', client_id: 'own-client', log_date: logDate, calories: 2000, protein: 100, carbs: 250, fats: 60, nutrition_calculation: { statusLabel: 'Saved individualized target' } }
  const tableRows = { nutrition_logs: log, nutrition_log_remaining: { calories_remaining: 1500, protein_remaining_g: 70, carbs_remaining_g: 200, fat_remaining_g: 45 }, nutrition_log_totals_by_block: [], macro_entries: entries }
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) },
    from(table) {
      const query = { select() { reads.push(table); return query }, eq() { return query }, in() { return query },
        maybeSingle: async () => ({ data: tableRows[table] ?? null, error: failRemaining && table === 'nutrition_log_remaining' ? { message: 'Unavailable' } : null }),
        then(done, reject) { return Promise.resolve({ data: tableRows[table] ?? [], error: null }).then(done, reject) },
      }
      return query
    },
  }
  const mocks = {
    react: state.react,
    'next/navigation': { useRouter: () => ({ refresh() {}, push() {} }) },
    '@/components/CardArtwork': CardArtworkModule,
    '@/lib/supabase/client': { createClient: () => db },
    '@/components/hydration/HydrationQuickAdd': { __esModule: true, default: 'water-entry' },
    '@/components/nutrition/MacroQuickAdd': { __esModule: true, default: 'macro-entry' },
    '@/components/NutritionFoodLogger': { __esModule: true, default: 'food-entry' },
    '@/components/nutrition/MicronutrientProgressRing': { __esModule: true, default: 'micro-ring' },
    '@/lib/timezone': { getClientLocalDateOffset: () => logDate, getClientTimeZone: () => 'UTC' },
    '@/lib/analytics': { trackEvent() {} },
    '@/lib/nutrition/micronutrientProgress': { calculateMicronutrientProgress: () => [], confirmedToxicityWarning: () => null, loadMicronutrientProgress: async () => ({ meals: [], upperLimits: [], macroEntryCount: 1, upperLimitsAvailable: true }) },
  }
  const load = loader(mocks, {
    document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
    window: { localStorage: storage, sessionStorage: storage, location: { hash: '' }, addEventListener() {}, removeEventListener() {} },
    fetch: async url => {
      requests.push(url)
      if (url.startsWith('/api/nutrition-log?')) return Response.json({ nutritionLog: log })
      if (url.includes('suggested-foods')) return Response.json({ state: 'ready', suggestions: [{ foodId: 'food', name: 'Food option', contribution: '+10g protein', reason: 'Based on saved intake' }] })
      return Response.json({})
    },
  })
  const Dashboard = load('components/AdaptiveNutritionDashboard.tsx').default
  const macro = { target: 100, remaining: 100 }
  let props = { program, recipes: [{ id: 'recipe', title: 'Preserved Phoenix recipe', reason: 'Based on your targets', totalMinutes: 10, macros: { protein: 30, calories: 450 }, ingredientLines: ['Food'], steps: ['Prepare food'], servings: 1, meal_type: 'lunch', tags: [] }], logic: { program, client: { id: 'own-client', program }, trends: [{ key: 'calories', label: 'Duplicate trend', values: [1, 2] }], nutrition: { calories: macro, protein: macro, carbs: macro, fats: macro, mealSuggestions: [] }, fuelReadiness: {}, hydration: { consumed: 24, target: 100 } } }
  const render = flush => state.render(Dashboard, props, flush)
  async function settle() { for (let index = 0; index < 7; index++) { await new Promise(setImmediate); render() } return render() }
  return { requests, reads, values, removals, render, settle,
    setTargets(updates) { Object.assign(log, updates) },
    setRemainingFailure(value) { failRemaining = value },
    setProgram(program) { props = { ...props, program, logic: { ...props.logic, program, client: { ...props.logic.client, program } } } },
  }
}

test('one daily targets card contains the four recorded-intake rings with no duplicate progress or goals', async () => {
  const app = fixture()
  app.render(); const tree = await app.settle()
  const targets = node(tree, value => value.type === 'section' && value.props?.['aria-label'] === 'Your daily nutrition targets')
  assert.ok(targets)
  const rings = nodes(targets).filter(value => value.props?.className === 'tier-metric-ring')
  assert.equal(rings.length, 4)
  assert.match(text(targets), /500\s*\/\s*2000\s*cal/)
  assert.match(text(targets), /30\s*\/\s*100\s*g/)
  assert.match(text(targets), /50\s*\/\s*250\s*g/)
  assert.match(text(targets), /15\s*\/\s*60\s*g/)
  assert.doesNotMatch(text(tree), /Goals \/ Assessment|BMI Context|Nutrition Progress|Daily Progress|Weekly Trends|Duplicate trend|Start with protein|Build a balanced plate/)
  assert.equal(nodes(tree).filter(value => value.props?.['data-testid'] === 'nutrition-progress-panel').length, 0)
})

test('Ember exposes whole-card macro and existing water dialog controls, without food tools or background suggestions', async () => {
  const oldKey = 'aos:view:v1:own-client:nutrition-intake'
  const app = fixture({ persisted: { [oldKey]: 'suggested' } })
  app.render(); const tree = await app.settle()
  assert.ok(node(tree, value => value.type === 'macro-entry'))
  const water = node(tree, value => value.type === 'water-entry')
  assert.ok(water)
  assert.equal(water.props.consumed, 24)
  assert.equal(water.props.clientId, 'own-client')
  let opened = false
  const waterControl = water.props.renderTrigger({ toggle: () => { opened = true }, triggerRef: { current: null } })
  assert.equal(waterControl.type, 'button')
  assert.match(text(waterControl), /Log Water/i)
  waterControl.props.onClick()
  assert.equal(opened, true)
  assert.doesNotMatch(text(tree), /Suggested Foods|Food Log|Micronutrients|Recipes/)
  assert.equal(nodes(tree).some(value => value.type === 'food-entry'), false)
  assert.equal(app.requests.some(url => url.includes('suggested-foods')), false)
  assert.notEqual(app.values.get(oldKey), 'suggested', 'The obsolete Ember selection is removed or replaced')
})

for (const tier of ['ignite', 'phoenix']) test(`${tier} keeps food logging, suggested foods and micronutrients after cleanup`, async () => {
  const app = fixture({ program: tier })
  app.render(); let tree = await app.settle()
  assert.ok(node(tree, value => value.type === 'food-entry'))
  assert.ok(app.requests.some(url => url.includes('suggested-foods')))
  assert.ok(button(tree, 'Suggested Foods'))
  const micros = button(tree, 'Micronutrients')
  assert.ok(micros)
  micros.props.onClick(); tree = await app.settle()
  assert.ok(node(tree, value => value.props?.['data-testid'] === 'nutrition-micronutrients-tab'))
  if (tier === 'phoenix') {
    const recipes = button(tree, 'Recipes'); assert.ok(recipes)
    recipes.props.onClick(); tree = await app.settle()
    const recipe = node(tree, value => typeof value.type === 'function' && value.props?.recipe?.id === 'recipe')
    assert.ok(recipe)
    assert.match(text(recipe.type(recipe.props)), /Preserved Phoenix recipe|Log foods from this recipe/)
  } else assert.equal(button(tree, 'Recipes'), undefined)
})

test('downgrading hides the higher-tier food selection and stops further suggested-food reads', async () => {
  const app = fixture({ program: 'phoenix' })
  app.render(); let tree = await app.settle()
  button(tree, 'Suggested Foods').props.onClick(); tree = await app.settle()
  assert.match(text(tree), /Food option/)
  const priorReads = app.requests.filter(url => url.includes('suggested-foods')).length
  app.setProgram('ember')
  tree = app.render(false)
  assert.doesNotMatch(text(tree), /Suggested Foods|Food option|Preserved Phoenix recipe/)
  await app.settle()
  assert.equal(app.requests.filter(url => url.includes('suggested-foods')).length, priorReads)
})

test('empty confirmed intake displays zero while a failed progress read remains unavailable', async () => {
  const empty = fixture({ entries: [] })
  empty.render(); const emptyTree = await empty.settle()
  const emptyTargets = node(emptyTree, value => value.props?.['aria-label'] === 'Your daily nutrition targets')
  assert.match(text(emptyTargets), /0\s*\/\s*2000\s*cal/)
  assert.equal(nodes(emptyTargets).filter(value => value.props?.className === 'tier-metric-ring').every(value => text(value) === '0%'), true)
  const unavailable = fixture({ failRemaining: true })
  unavailable.render(); const unavailableTree = await unavailable.settle()
  const unavailableTargets = node(unavailableTree, value => value.props?.['aria-label'] === 'Your daily nutrition targets')
  assert.match(text(unavailableTargets), /Logged amount unavailable|Target 2000 cal/)
  assert.doesNotMatch(text(unavailableTargets), /0\s*\/\s*2000/)
  assert.equal(nodes(unavailableTargets).filter(value => value.props?.className === 'tier-metric-ring').every(value => text(value) === '—'), true)
})

test('a new target with a failed remaining refresh cannot infer intake from the previous target’s totals', async () => {
  const app = fixture()
  app.render(); let tree = await app.settle()
  const targets = () => node(tree, value => value.props?.['aria-label'] === 'Your daily nutrition targets')
  assert.match(text(targets()), /500\s*\/\s*2000\s*cal/)
  app.setTargets({ calories: 2200 })
  app.setRemainingFailure(true)
  await assert.rejects(node(tree, value => value.type === 'macro-entry').props.onRefresh(), /Saved nutrition progress could not be loaded/)
  tree = await app.settle()
  assert.match(text(targets()), /Target\s+2200\s+cal/)
  assert.match(text(targets()), /Logged amount unavailable/)
  assert.doesNotMatch(text(targets()), /700\s*\/\s*2200|500\s*\/\s*2000/)
  assert.equal(nodes(targets()).filter(value => value.props?.className === 'tier-metric-ring').every(value => text(value) === '—'), true)
})

test('daily ring calculations retain over-target intake and distinguish unavailable fields from zero', () => {
  const { buildDailyMacroMetrics } = loader({}, {})('lib/nutrition/dailyMacroMetrics.ts')
  const [calories, protein, carbs, fats] = buildDailyMacroMetrics({ calories: '2000', protein: 100, carbs: 250, fats: 0 }, { calories_remaining: -150, protein_remaining_g: 100, carbs_remaining_g: null, fat_remaining_g: 0 })
  assert.equal(calories.consumed, 2150)
  assert.equal(calories.remaining, -150)
  assert.equal(calories.percent, 100)
  assert.equal(protein.consumed, 0)
  assert.equal(protein.percent, 0)
  assert.equal(carbs.target, 250)
  assert.equal(carbs.consumed, null)
  assert.equal(carbs.percent, null)
  assert.equal(fats.target, 0)
  assert.equal(fats.consumed, 0)
  assert.equal(fats.percent, 0)
  for (const value of [null, undefined, '', ' ', NaN, Infinity, 'invalid', -20]) {
    const metric = buildDailyMacroMetrics({ calories: value }, { calories_remaining: 0 })[0]
    assert.equal(metric.target, null)
    assert.equal(metric.consumed, null)
    assert.equal(metric.percent, null)
  }
})

function macroFixture({ request = async () => Response.json({ success: true, entry: { id: 'saved-entry' }, remaining: { calories_remaining: 1500 } }), values = new Map(), onSaved = async () => {}, onRefresh = async () => {}, overrides = {} } = {}) {
  const state = hooks(), calls = [], focus = [], dialogs = []
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  const Component = loader({ react: state.react, '@/lib/timezone': { getClientLocalDateOffset: () => '2026-11-04' } }, {
    window: { localStorage: storage }, fetch: async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return request(url, options) },
  })('components/nutrition/MacroQuickAdd.tsx').default
  const props = { clientId: 'own-client', logDate: '2026-11-04', timezone: 'UTC', nutritionLogId: 'own-log', onSaved, onRefresh,
    renderTrigger: ({ toggle, triggerRef }) => ({ type: 'button', ref: triggerRef, props: { onClick: toggle, children: 'Open macro card' } }),
    ...overrides,
  }
  function attach(tree) {
    for (const element of nodes(tree)) {
      const ref = element.ref || element.props?.ref
      if (!ref || ref.current) continue
      if (element.type === 'dialog') {
        const dialog = { open: false, showModal() { this.open = true; dialogs.push('open') }, close() { this.open = false; dialogs.push('close') } }
        ref.current = dialog
      } else ref.current = { focus: () => focus.push(element.props?.id || 'trigger') }
    }
  }
  const render = () => state.render(Component, props, true, attach)
  async function settle() { for (let index = 0; index < 4; index++) { await new Promise(setImmediate); render() } return render() }
  render(); render()
  return { render, settle, calls, values, focus, dialogs }
}
const form = tree => node(tree, value => value.type === 'form')
function fillMacro(app, values = ['500', '30', '50', '15']) {
  let tree = app.render()
  nodes(tree).filter(value => value.type === 'input').forEach((input, index) => input.props.onChange({ target: { value: values[index] } }))
  return app.render()
}

test('macro card opens a labelled native dialog, focuses its first field, and restores trigger focus on Escape', () => {
  const app = macroFixture()
  let tree = app.render()
  button(tree, 'Open macro card').props.onClick(); tree = app.render()
  const dialog = node(tree, value => value.type === 'dialog')
  assert.deepEqual(app.dialogs, ['open'])
  assert.ok(node(tree, value => value.props?.id === dialog.props['aria-labelledby']))
  assert.ok(node(tree, value => value.props?.id === dialog.props['aria-describedby']))
  assert.match(app.focus.at(-1), /calories$/)
  for (const input of nodes(tree).filter(value => value.type === 'input')) assert.ok(node(tree, value => value.type === 'label' && value.props.htmlFor === input.props.id))
  dialog.props.onCancel(); tree = app.render()
  assert.deepEqual(app.dialogs, ['open', 'close'])
  node(tree, value => value.type === 'dialog').props.onClose()
  assert.equal(app.focus.at(-1), 'trigger')
  assert.equal(app.calls.length, 0)
})

test('macro submission commits once for rapid double-submit and clears the additive draft only after confirmation', async () => {
  let release
  const pending = new Promise(resolve => { release = resolve })
  let saved = null
  const app = macroFixture({ request: () => pending, onSaved: async remaining => { saved = remaining } })
  let tree = fillMacro(app)
  const submit = form(tree).props.onSubmit
  const first = submit({ preventDefault() {} }), second = submit({ preventDefault() {} })
  tree = app.render()
  assert.equal(app.calls.length, 1)
  assert.equal(nodes(tree).filter(value => value.type === 'input').every(value => value.props.disabled), true)
  assert.equal(app.calls[0].url, '/api/nutrition/add-macros')
  assert.deepEqual(app.calls[0].body, { nutritionLogId: 'own-log', calories: 500, protein: 30, carbs: 50, fats: 15, mealPeriod: app.calls[0].body.mealPeriod })
  assert.equal(app.values.size, 1)
  release(Response.json({ success: true, entry: { id: 'saved-once' }, remaining: { calories_remaining: 1500 } }))
  await Promise.all([first, second]); tree = await app.settle()
  assert.equal(app.calls.length, 1)
  assert.equal(app.values.size, 0)
  assert.deepEqual(saved, { calories_remaining: 1500 })
  assert.equal(nodes(tree).filter(value => value.type === 'input').every(value => value.props.value === ''), true)
  assert.match(text(tree), /Macros saved/)
  assert.equal(node(tree, value => value.type === 'button' && value.props.type === 'submit').props.disabled, true)
})

test('confirmed macro success remains success when refreshing saved totals fails', async () => {
  const app = macroFixture({ onSaved: async () => { throw new Error('Refresh unavailable') } })
  await form(fillMacro(app)).props.onSubmit({ preventDefault() {} })
  const tree = await app.settle()
  assert.match(text(tree), /Macros saved\. Saved totals could not be refreshed yet\. Do not add this entry again/)
  assert.equal(app.calls.length, 1)
  assert.equal(app.values.size, 0)
  assert.equal(nodes(tree).filter(value => value.type === 'input').every(value => value.props.value === ''), true)
})

test('a lost macro response remains blocked across close, remount, and totals review without automatic retries', async () => {
  const values = new Map()
  const app = macroFixture({ values, request: async () => { throw new TypeError('Response lost after insert') } })
  await form(fillMacro(app)).props.onSubmit({ preventDefault() {} })
  let tree = await app.settle()
  assert.match(text(tree), /could not be confirmed/)
  assert.equal(app.calls.length, 1)
  assert.equal(values.size, 1)
  assert.equal(nodes(tree).filter(value => value.type === 'input').every(value => value.props.disabled), true)
  const reloaded = macroFixture({ values })
  tree = reloaded.render()
  await form(tree).props.onSubmit({ preventDefault() {} })
  assert.equal(reloaded.calls.length, 0)
  button(tree, 'Check saved totals').props.onClick(); tree = await reloaded.settle()
  assert.equal(values.size, 1, 'A totals refresh cannot establish whether an additive request committed')
  assert.match(text(tree), /earlier save will not be retried/)
  assert.equal(reloaded.calls.length, 0)
  button(tree, 'Start a separate entry').props.onClick(); tree = reloaded.render()
  assert.equal(values.size, 0)
  assert.equal(nodes(tree).filter(value => value.type === 'input').every(value => value.props.value === ''), true)
  assert.equal(reloaded.calls.length, 0)
})

test('macro values reject an empty entry, negatives and fractions without sending an additive request', async () => {
  for (const values of [['', '', '', ''], ['500', '-1', '', ''], ['1.5', '', '', '']]) {
    const app = macroFixture()
    await form(fillMacro(app, values)).props.onSubmit({ preventDefault() {} })
    assert.equal(app.calls.length, 0)
    assert.equal(app.values.size, 0)
  }
})

test('unavailable and still-loading macro logs stay labelled and cannot submit', async () => {
  for (const [overrides, expected] of [[{ nutritionLogId: null }, /macro entry is unavailable/], [{ loading: true }, /Preparing today’s macro entry/]]) {
    const app = macroFixture({ overrides })
    const tree = fillMacro(app)
    await form(tree).props.onSubmit({ preventDefault() {} })
    assert.match(text(tree), expected)
    assert.equal(nodes(tree).filter(value => value.type === 'input').every(value => value.props.disabled), true)
    assert.equal(app.calls.length, 0)
    assert.equal(app.values.size, 0)
  }
})

test('an explicit pre-insert validation response allows editing while server uncertainty keeps the no-retry marker', async () => {
  for (const status of [400, 500]) {
    const app = macroFixture({ request: async () => Response.json({ error: 'Synthetic error' }, { status }) })
    await form(fillMacro(app)).props.onSubmit({ preventDefault() {} })
    const tree = await app.settle()
    assert.equal(app.values.size, status === 400 ? 0 : 1)
    assert.equal(nodes(tree).filter(value => value.type === 'input').every(value => value.props.disabled), status === 500)
    assert.match(text(tree), status === 400 ? /Synthetic error/ : /could not be confirmed/)
    assert.equal(app.calls.length, 1)
  }
})

test('a degraded confirmed response clears the draft and reports saved intake without another write', async () => {
  const app = macroFixture({ request: async () => Response.json({ success: true, entry: { id: 'confirmed' }, refreshStatus: 'degraded' }) })
  await form(fillMacro(app)).props.onSubmit({ preventDefault() {} })
  const tree = await app.settle()
  assert.match(text(tree), /Macros saved\. Some totals are still refreshing\. Do not add this entry again/)
  assert.equal(app.values.size, 0)
  assert.equal(app.calls.length, 1)
  assert.equal(nodes(tree).filter(value => value.type === 'input').every(value => value.props.value === ''), true)
})
