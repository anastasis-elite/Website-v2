import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, posix, resolve } from 'node:path'
import ts from 'typescript'

const root = resolve('.')
const guardedEntries = [
  'lib/program/generateProgram.ts',
  'lib/nutrition/targetEngine.ts',
  'lib/nutrition/targetService.ts',
  'lib/dashboard/logic/engines.ts',
  'lib/dashboard/logic/getProgramLogicEngine.ts',
  'lib/dashboard/logic/getProgramLogicForClient.ts',
  'lib/dashboard/logic/loadProgramLogicInputs.ts',
  'lib/day/getDailyExecutionPlan.ts',
  'lib/dashboard/requestReads.ts',
  'lib/dashboard/buildTodayViewModel.ts',
  'lib/dashboard/todayActivities.ts',
  'lib/dashboard/dailyRecommendation.ts',
  'lib/dashboard/logic/streakRequirementProgress.ts',
]
const authoritativeModules = new Set([...guardedEntries,
  'lib/workout-os/runWorkoutOS.ts', 'lib/workout-os/capacityFilter.ts',
])

function sourceFiles(folder) {
  return readdirSync(join(root, folder), { withFileTypes: true }).flatMap(entry => {
    const path = `${folder}/${entry.name}`
    return entry.isDirectory() ? sourceFiles(path)
      : /\.[jt]sx?$/.test(path) && !path.endsWith('.d.ts') ? [path] : []
  })
}

function importGraph() {
  const files = ['app', 'components', 'lib'].flatMap(sourceFiles)
  const sources = new Map(), modules = new Map()
  const read = file => {
    if (!sources.has(file)) sources.set(file, readFileSync(join(root, file), 'utf8'))
    return sources.get(file)
  }
  function localModule(from, specifier) {
    const base = specifier.startsWith('@/') ? specifier.slice(2)
      : specifier.startsWith('.') ? posix.normalize(posix.join(dirname(from), specifier)) : null
    if (base === null) return null
    for (const candidate of [base, ...['.ts', '.tsx', '.js', '.jsx'].map(extension => base + extension),
      ...['.ts', '.tsx', '.js', '.jsx'].map(extension => base + '/index' + extension)]) {
      if (existsSync(join(root, candidate)) && statSync(join(root, candidate)).isFile()) return candidate
    }
    return null
  }
  function module(file) {
    if (modules.has(file)) return modules.get(file)
    // Inspect emitted runtime imports. This handles type-only declarations,
    // mixed imports and values used only in type positions without treating
    // allowed display interfaces as executable dependencies.
    const javascript = ts.transpileModule(read(file), { fileName: file, compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022,
      jsx: ts.JsxEmit.ReactJSX, isolatedModules: true,
    } }).outputText
    const syntax = ts.createSourceFile(file + '.js', javascript, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
    const info = { dependencies: [], serverOnly: false, unresolved: [] }
    function add(specifier) {
      if (specifier === 'server-only') { info.serverOnly = true; return }
      const local = localModule(file, specifier)
      if (local && !/\.(?:json|css|png|jpe?g|gif|svg|webp|ico|woff2?)$/.test(local)) info.dependencies.push(local)
      else if (!local && (specifier.startsWith('@/') || specifier.startsWith('.')) &&
        !/\.(?:css|png|jpe?g|gif|svg|webp|ico|woff2?)$/.test(specifier)) info.unresolved.push(specifier)
    }
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) add(node.moduleSpecifier.text)
      if (ts.isCallExpression(node) && node.arguments.length &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
        if (ts.isStringLiteralLike(node.arguments[0])) add(node.arguments[0].text)
        else info.unresolved.push('<nonliteral dynamic import>')
      }
      // Module workers are browser runtime too, even though their dependency
      // appears as a bundler-recognized URL rather than an import declaration.
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Worker') {
        const url = node.arguments?.[0]
        if (url && ts.isNewExpression(url) && ts.isIdentifier(url.expression) && url.expression.text === 'URL' &&
          url.arguments?.[0] && ts.isStringLiteralLike(url.arguments[0])) add(url.arguments[0].text)
        else info.unresolved.push('<nonliteral worker module>')
      }
      ts.forEachChild(node, visit)
    }
    visit(syntax); modules.set(file, info)
    return info
  }
  const clientRoots = files.filter(file => {
    const syntax = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true)
    return syntax.statements.some(statement => ts.isExpressionStatement(statement) &&
      ts.isStringLiteral(statement.expression) && statement.expression.text === 'use client')
  })
  function inspect() {
    const violations = [], unresolved = []
    for (const entry of clientRoots) {
      const visited = new Set()
      function walk(file, trace) {
        if (visited.has(file)) return
        visited.add(file)
        const info = module(file), route = [...trace, file]
        if (info.serverOnly || authoritativeModules.has(file)) violations.push(route)
        for (const specifier of info.unresolved) unresolved.push({ entry, file, specifier })
        for (const dependency of info.dependencies) walk(dependency, route)
      }
      walk(entry, [])
    }
    return { violations, unresolved, clientRoots: clientRoots.length, runtimeModules: modules.size }
  }
  return { module, inspect }
}

const graph = importGraph()

test('emitted client runtime graphs cannot reach server-only Today decisions or proprietary formula entries', t => {
  const result = graph.inspect()
  assert.ok(result.clientRoots > 0, 'The check must discover real use-client roots.')
  assert.equal(result.violations.length, 0, result.violations.map(trace => trace.join(' -> ')).join('\n'))
  assert.deepEqual(result.unresolved, [], 'Unresolved local/dynamic imports require explicit review; they cannot count as a clean graph.')
  t.diagnostic(`${result.clientRoots} client roots and ${result.runtimeModules} local runtime modules checked, including literal module workers.`)
})

test('authoritative entry points are guarded while shared Today display types emit no executable dependencies', () => {
  for (const path of guardedEntries) assert.equal(graph.module(path).serverOnly, true, `${path} needs its explicit server-only guard.`)
  for (const path of ['lib/dashboard/todayViewModelTypes.ts', 'lib/dashboard/dailyRecommendationTypes.ts',
    'lib/dashboard/logic/streakRequirementProgressTypes.ts']) {
    const info = graph.module(path)
    assert.equal(info.serverOnly, false, `${path} must remain available as display types.`)
    assert.deepEqual(info.dependencies, [], `${path} must not pull a runtime engine into the browser.`)
    assert.deepEqual(info.unresolved, [])
  }
})
