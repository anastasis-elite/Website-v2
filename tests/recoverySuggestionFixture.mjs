import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'

const nativeRequire = createRequire(import.meta.url)
const timezone = await importTs('lib/timezone.ts')
const scheduleTime = await importTs('lib/schedule/time.ts')
const module = { exports: {} }
const compiled = ts.transpileModule(readFileSync('components/recovery/RecoverySuggestionCard.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText
runInNewContext(compiled, {
  module, exports: module.exports, Date,
  require: name => name === '@/lib/timezone' ? timezone : name === '@/lib/schedule/time' ? scheduleTime
    : name.endsWith('.module.css') ? { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
      : nativeRequire(name),
})
export default module.exports
