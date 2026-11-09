import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const nativeRequire = createRequire(import.meta.url)
// Matches the supplied WebP assets, including the portrait Daily Check-In artwork.
const artworkDimensions = { 320: { width: 320, height: 213 }, 640: { width: 640, height: 427 } }
function artworkMetadata(name) {
  const variant = /-(320|640)\.webp$/.exec(name)?.[1]
  if (!variant) throw new Error(`Missing artwork dimensions for ${name}`)
  return { src: `/_next/static/media/${basename(name)}`, ...(basename(name).startsWith('check-in-') ? { width: Number(variant), height: Number(variant) === 320 ? 350 : 700 } : artworkDimensions[variant]) }
}
const module = { exports: {} }
const compiled = ts.transpileModule(readFileSync('components/CardArtwork.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText
runInNewContext(compiled, {
  module, exports: module.exports,
  require: name => name.endsWith('.webp') ? artworkMetadata(name) : nativeRequire(name),
})

export default module.exports
