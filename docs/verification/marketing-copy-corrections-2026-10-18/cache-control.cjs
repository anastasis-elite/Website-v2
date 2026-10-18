// Verification-only: disable Webpack's optional filesystem cache on this nearly full host.
// Does not edit Next/app configuration, compilation rules, runtime cache, or application source.
const Module = require('node:module')
const path = require('node:path')
const root = path.join(__dirname, 'Website-v2')
const target = require.resolve(path.join(root, 'node_modules/next/dist/build/webpack-config.js'))
const originalLoad = Module._load
const originalResolve = Module._resolveFilename
const wrapped = new WeakMap()
Module._load = function (request, parent, isMain) {
  const loaded = originalLoad.apply(this, arguments)
  if (!String(request).includes('webpack-config')) return loaded
  let resolved
  try { resolved = originalResolve.call(this, request, parent, isMain) } catch { return loaded }
  if (resolved !== target || !loaded || typeof loaded.default !== 'function') return loaded
  if (!wrapped.has(loaded)) {
    const withoutDiskCache = async (...args) => {
      const config = await loaded.default(...args)
      config.cache = false
      console.log('[isolated verification] Optional Webpack filesystem cache disabled:', config.name)
      return config
    }
    wrapped.set(loaded, new Proxy(loaded, { get(target, key, receiver) {
      return key === 'default' ? withoutDiskCache : Reflect.get(target, key, receiver)
    } }))
  }
  return wrapped.get(loaded)
}
