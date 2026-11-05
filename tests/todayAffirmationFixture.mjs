import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const nativeRequire = createRequire(import.meta.url)
const module = { exports: {} }
const compiled = ts.transpileModule(readFileSync('components/program-dashboard/TodayAffirmation.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText
runInNewContext(compiled, {
  module, exports: module.exports,
  require: name => name === 'next/link' ? { __esModule: true, default: 'a' }
    : name.endsWith('.module.css') ? { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
      : nativeRequire(name),
})

export default module.exports
