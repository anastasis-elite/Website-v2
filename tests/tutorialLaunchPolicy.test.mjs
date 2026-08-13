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
