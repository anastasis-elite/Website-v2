import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const nativeRequire = createRequire(import.meta.url)
const module = { exports: {} }
const compiled = ts.transpileModule(readFileSync('components/CardArtwork.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText
runInNewContext(compiled, {
  module, exports: module.exports,
  require: name => name.endsWith('.webp') ? { src: `/_next/static/media/${basename(name)}` } : nativeRequire(name),
})

export default module.exports
