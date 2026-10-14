import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import ts from 'typescript'
export function typescriptModuleUrl(path, mocks = {}, cache = new Map()) {
  path = resolve(path)
  if (cache.has(path)) return cache.get(path)
  const source = readFileSync(path, 'utf8')
  let { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2022 } })
  // Next's server-only marker is enforced by the application compiler; it has
  // no runtime implementation in these disposable Node route tests.
  outputText = outputText.replace(/^import ['"]server-only['"];?\s*$/gm, '')
  outputText = outputText.replace(/from ['"]([^'"]+)['"]/g, (match, specifier) => {
    const mocked = mocks[specifier]
    if (mocked !== undefined) return `from 'data:text/javascript;base64,${Buffer.from(mocked).toString('base64')}'`
    const dependency = specifier.startsWith('@/') ? resolve(specifier.slice(2) + '.ts') : specifier.startsWith('.') ? resolve(dirname(path), specifier + '.ts') : null
    return dependency ? `from '${typescriptModuleUrl(dependency, mocks, cache)}'` : match
  })
  const url = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  cache.set(path, url)
  return url
}
export const importTs = (path, mocks) => import(typescriptModuleUrl(path, mocks))
