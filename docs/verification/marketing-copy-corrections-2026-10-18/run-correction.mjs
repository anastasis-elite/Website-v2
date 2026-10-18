import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const require = createRequire(import.meta.url)
const { isolatedEnvironment, assertNoEnvironmentFiles } = require('./evidence/isolation.cjs')
const base = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(base, 'Website-v2')
assertNoEnvironmentFiles(root)
const args = process.argv.slice(2)
const mode = args.shift()
const env = isolatedEnvironment(process.env, { loopback: false, nodeEnv: mode === 'build' ? 'production' : 'test' })
const commands = {
  test: ['--test', ...args],
  typecheck: ['node_modules/typescript/bin/tsc', '--noEmit', '--incremental', 'false'],
  lint: ['node_modules/next/dist/bin/next', 'lint'],
  build: ['--require', path.join(base, 'cache-control.cjs'), 'node_modules/next/dist/bin/next', 'build'],
}
if (!commands[mode]) throw new Error('Use test, typecheck, lint, or build')
const child = spawn(process.execPath, commands[mode], { cwd: root, env, stdio: 'inherit' })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))
child.on('error', error => { console.error(error); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
