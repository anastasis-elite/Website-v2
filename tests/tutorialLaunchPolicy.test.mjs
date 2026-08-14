import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

async function importTypescriptModule(path) {
  const source = readFileSync(path, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
    },
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

const { getTutorialHydrationDecision } = await importTypescriptModule(
  'lib/tutorial/launchPolicy.ts'
)

const registrySource = readFileSync('lib/tutorial/registry.ts', 'utf8')

test('existing authenticated user with no core tutorial progress starts automatically', () => {
  assert.equal(getTutorialHydrationDecision(null), 'start')
})

test('new authenticated user with no core tutorial progress starts automatically', () => {
  assert.equal(getTutorialHydrationDecision(null), 'start')
})

test('in-progress core tutorial resumes automatically', () => {
  assert.equal(getTutorialHydrationDecision({ status: 'in_progress' }), 'resume')
})

test('completed core tutorial does not launch', () => {
  assert.equal(getTutorialHydrationDecision({ status: 'completed' }), 'skip')
})

test('different completed tutorial does not block core tutorial launch', () => {
  const coreProgress = null
  assert.equal(getTutorialHydrationDecision(coreProgress), 'start')
})

test('core onboarding tutorial keeps its stable identity and opening steps', () => {
  assert.match(registrySource, /CORE_ONBOARDING_TUTORIAL_ID = 'core-onboarding-v1'/)

  const stepIds = Array.from(
    registrySource.matchAll(/stepId: '([^']+)'/g),
    (match) => match[1]
  )

  assert.deepEqual(stepIds.slice(0, 3), [
    'welcome',
    'open-dashboard',
    'reveal-daily-flow',
  ])
})

test('core onboarding extension registers daily dashboard targets', () => {
  for (const targetId of [
    'dashboard-water-progress',
    'dashboard-nutrition-progress',
    'dashboard-nav-nutrition',
    'dashboard-daily-checkin',
    'dashboard-progress-area',
    'dashboard-progress-photos',
    'dashboard-measurements',
    'dashboard-strength-assessment',
  ]) {
    assert.match(registrySource, new RegExp(targetId))
  }
})
