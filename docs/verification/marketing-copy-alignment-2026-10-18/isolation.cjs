// Local Package A QA only. Loaded before test/application imports, including Node children.
// This is a fail-closed Node transport guard, not an operating-system network sandbox.
const fs = require('node:fs')
const { syncBuiltinESMExports } = require('node:module')

const preload = __filename
const marker = 'PACKAGE_A_TEST_ISOLATED'
const synthetic = {
  [marker]: '1',
  NEXT_TELEMETRY_DISABLED: '1',
  DO_NOT_TRACK: '1',
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'package-a-synthetic-anon-key',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'package-a-synthetic-publishable-key',
  SUPABASE_SERVICE_ROLE_KEY: 'package-a-synthetic-service-role-key',
  NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3101',
  NEXT_PUBLIC_POSTHOG_HOST: 'http://127.0.0.1:9',
  POSTHOG_HOST: 'http://127.0.0.1:9',
  NEXT_PUBLIC_POSTHOG_KEY: '',
  STRIPE_SECRET_KEY: '',
  STRIPE_WEBHOOK_SECRET: '',
  RESEND_API_KEY: '',
  PAYMENT_TEST_DATABASE_ISOLATED: 'true',
}

function isolatedEnvironment(source = {}, { loopback = false, nodeEnv = 'test' } = {}) {
  // A positive allowlist prevents inherited production credentials, proxies and NODE_OPTIONS.
  const env = {}
  for (const [key, value] of Object.entries(source)) {
    if (/^(PATH|TMPDIR|TMP|TEMP|LANG|LC_[A-Z_]+|TERM|NO_COLOR|FORCE_COLOR|TZ|PLAYWRIGHT_MODULE|CHROMIUM_EXECUTABLE|DASHBOARD_QA_URL|DASHBOARD_QA_OUTPUT|AUDIT_QA_ORIGIN|AUDIT_QA_OUTPUT)$/.test(key)) env[key] = value
  }
  return { ...env, ...synthetic, NODE_ENV: nodeEnv,
    [marker + '_LOOPBACK']: loopback ? '1' : '0',
    NODE_OPTIONS: `--require=${JSON.stringify(preload)}` }
}

function assertNoEnvironmentFiles(directory) {
  const unsafe = fs.readdirSync(directory).filter(name => /^\.env(?:\.|$)/.test(name) && name !== '.env.example')
  if (unsafe.length) throw new Error(`Package A isolation refuses environment files: ${unsafe.join(', ')}. Use a clean QA checkout.`)
}

function installGuard() {
  if (globalThis[Symbol.for('package-a-test-isolation')]) return
  const loopback = process.env[marker + '_LOOPBACK'] === '1'
  const deny = kind => {
    const error = new Error(`Package A isolation blocked ${kind}; use an in-process mock or verified loopback fixture.`)
    error.code = 'PACKAGE_A_NETWORK_BLOCKED'
    throw error
  }
  const localHost = host => ['127.0.0.1', '::1', '[::1]', 'localhost'].includes(String(host).toLowerCase())
  const assertHost = host => { if (!loopback || !localHost(host)) deny('network transport') }
  const assertUrl = value => {
    let url
    try { url = new URL(typeof value === 'string' || value instanceof URL ? value : value.url) }
    catch { return deny('unrecognized network URL') }
    if (['data:', 'blob:'].includes(url.protocol)) return
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) deny('network protocol')
    // Port 9 is reserved by this fixture as an unreachable synthetic service endpoint.
    if (url.port === '9') deny('synthetic service endpoint')
    assertHost(url.hostname)
  }
  const socketOptions = args => {
    if (Array.isArray(args[0])) return socketOptions(args[0])
    if (args[0] && typeof args[0] === 'object') return args[0]
    if (typeof args[0] === 'string' && !/^\d+$/.test(args[0])) deny('Unix socket')
    return { port: args[0], host: typeof args[1] === 'string' ? args[1] : 'localhost' }
  }
  const checkSocket = args => {
    const options = socketOptions(args)
    if (options.path || Number(options.port) === 9) deny('service socket')
    assertHost(options.host || options.hostname || 'localhost')
  }
  const wrap = (object, name, check) => {
    const original = object[name]
    if (typeof original !== 'function') return
    object[name] = function (...args) { check(args); return Reflect.apply(original, this, args) }
  }

  const nativeFetch = globalThis.fetch
  // Writable deliberately: existing in-process fetch mocks remain supported.
  globalThis.fetch = async (input, init) => { assertUrl(input); return nativeFetch(input, init) }
  if (globalThis.WebSocket) {
    const NativeWebSocket = globalThis.WebSocket
    globalThis.WebSocket = class extends NativeWebSocket {
      constructor(url, ...args) { assertUrl(url); super(url, ...args) }
    }
  }
  const net = require('node:net')
  wrap(net.Socket.prototype, 'connect', checkSocket)
  wrap(net, 'connect', checkSocket)
  wrap(net, 'createConnection', checkSocket)
  wrap(net.Server.prototype, 'listen', args => {
    const options = socketOptions(args)
    if (options.path) deny('Unix socket listener')
    assertHost(options.host || '0.0.0.0')
  })
  wrap(require('node:tls'), 'connect', checkSocket)
  for (const module of ['node:http', 'node:https']) {
    const http = require(module)
    const check = args => {
      if (typeof args[0] === 'string' || args[0] instanceof URL) assertUrl(args[0])
      else {
        const options = args[0] || {}
        if (options.socketPath || Number(options.port) === 9) deny('HTTP service socket')
        assertHost(options.hostname || options.host || 'localhost')
      }
    }
    wrap(http, 'request', check)
    wrap(http, 'get', check)
  }
  wrap(require('node:http2'), 'connect', args => assertUrl(args[0]))
  const udp = require('node:dgram')
  for (const method of ['send', 'connect', 'bind']) wrap(udp.Socket.prototype, method, () => deny('UDP transport'))
  const dns = require('node:dns')
  // Localhost resolves without any DNS query when loopback is explicitly enabled.
  dns.lookup = (host, options, callback) => {
    assertHost(host)
    if (typeof options === 'function') { callback = options; options = {} }
    const family = options?.family === 6 || host === '::1' ? 6 : 4
    const address = family === 6 ? '::1' : '127.0.0.1'
    process.nextTick(() => options?.all ? callback(null, [{ address, family }]) : callback(null, address, family))
  }
  dns.promises.lookup = async (host, options) => {
    assertHost(host)
    const family = options?.family === 6 || host === '::1' ? 6 : 4
    const value = { address: family === 6 ? '::1' : '127.0.0.1', family }
    return options?.all ? [value] : value
  }
  for (const object of [dns, dns.promises, dns.Resolver.prototype, dns.promises.Resolver.prototype]) {
    for (const method of Object.getOwnPropertyNames(object)) {
      if (/^(resolve|reverse|setServers)/.test(method)) wrap(object, method, () => deny('DNS transport'))
    }
  }

  const child = require('node:child_process')
  const nodeExecutable = fs.realpathSync(process.execPath)
  const childOptions = options => {
    if (options?.shell) deny('child shell')
    const env = { ...(options?.env || process.env), ...synthetic,
      [marker + '_LOOPBACK']: loopback ? '1' : '0',
      NODE_OPTIONS: `--require=${JSON.stringify(preload)}` }
    // Child Node processes keep non-secret build/test control variables and inherit the guard.
    for (const key of Object.keys(env)) {
      if (/(TOKEN|SECRET|PASSWORD|CREDENTIAL|API_KEY|PROXY|DATABASE_URL|SUPABASE|STRIPE|RESEND)/i.test(key) && !(key in synthetic)) delete env[key]
    }
    return { ...options, env }
  }
  const assertNode = command => {
    let executable
    try { executable = fs.realpathSync(command === 'node' ? process.execPath : command) }
    catch { return deny('unverified child executable') }
    if (executable !== nodeExecutable) deny('native child executable')
  }
  for (const method of ['spawn', 'spawnSync', 'execFile', 'execFileSync']) {
    const original = child[method]
    child[method] = function (command, args, options, callback) {
      assertNode(command)
      if (!Array.isArray(args)) { callback = options; options = args; args = [] }
      if (typeof options === 'function') { callback = options; options = undefined }
      return Reflect.apply(original, this, [command, args, childOptions(options), ...(callback ? [callback] : [])])
    }
  }
  const originalFork = child.fork
  child.fork = function (file, args, options) {
    if (!Array.isArray(args)) { options = args; args = [] }
    assertNode(options?.execPath || process.execPath)
    return Reflect.apply(originalFork, this, [file, args, childOptions(options)])
  }
  for (const method of ['exec', 'execSync']) child[method] = () => deny('child shell')
  const workers = require('node:worker_threads')
  const NativeWorker = workers.Worker
  workers.Worker = class extends NativeWorker {
    constructor(file, options = {}) {
      const env = options.env === workers.SHARE_ENV ? process.env : options.env
      super(file, { ...options, env: childOptions({ env }).env,
        execArgv: [...(options.execArgv || process.execArgv), '--require', preload] })
    }
  }
  syncBuiltinESMExports()
  Object.defineProperty(globalThis, Symbol.for('package-a-test-isolation'), { value: Object.freeze({ loopback }) })
}

module.exports = { isolatedEnvironment, assertNoEnvironmentFiles, installGuard }
if (process.env[marker] === '1') installGuard()
