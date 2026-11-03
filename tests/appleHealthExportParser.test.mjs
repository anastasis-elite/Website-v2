import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname, extname } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const { zipSync, strToU8 } = require('fflate')
const encoder = new TextEncoder()
function loadParser(limitChanges = {}, globalValues = {}) {
  const modules = new Map()
  const context = { Date, Map, Set, Intl, TextEncoder, TextDecoder, AbortController, Uint8Array, DataView, Blob, File,
    console: { log() { assert.fail('Health contents must not be logged.') }, error() { assert.fail('Health contents must not be logged.') } },
    fetch() { assert.fail('Local parsing must not upload or fetch.') }, ...globalValues }
  function load(path) {
    path = resolve(path)
    if (modules.has(path)) return modules.get(path).exports
    const module = { exports: {} }; modules.set(path, module)
    const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText
    runInNewContext(code, { ...context, module, exports: module.exports, require(name) {
      const target = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
      return target ? load(extname(target) ? target : target + '.ts') : require(name)
    } }, { filename: path })
    if (path.endsWith('/shared.ts') && Object.keys(limitChanges).length) module.exports.APPLE_EXPORT_LIMITS = { ...module.exports.APPLE_EXPORT_LIMITS, ...limitChanges }
    return module.exports
  }
  return { ...load('lib/health/appleExport/parser.ts'), shared: load('lib/health/appleExport/shared.ts') }
}
const { parseAppleHealthExport, shared } = loadParser()
const record = (patch = {}) => ({ type: 'HKQuantityTypeIdentifierHeartRate', sourceName: 'Synthetic Watch', sourceVersion: '1.0',
  device: 'Synthetic device', unit: 'count/min', creationDate: '2026-11-02 12:01:00 +0000',
  startDate: '2026-11-02 12:00:00 +0000', endDate: '2026-11-02 12:00:05 +0000', value: '72', ...patch })
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const node = attributes => '<Record ' + Object.entries(attributes).map(([key, value]) => `${key}="${escape(value)}"`).join(' ') + '/>'
const xml = (...rows) => '<?xml version="1.0" encoding="UTF-8"?><HealthData locale="en_US"><Me secret="RAW_UNRELATED_SECRET"/>' + rows.map(value => typeof value === 'string' ? value : node(value)).join('') + '</HealthData>'
const file = (content, name = 'export.xml') => new File([content], name)
const preview = (content, date = '2026-11-02', timezone = 'UTC', options) => parseAppleHealthExport(file(content), date, timezone, options)
const expectError = async (promise, code) => assert.rejects(promise, error => error.name === 'AppleExportParseError' && (!code || error.code === code) && !error.message.includes('RAW_'))
const u16 = (data, offset) => new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(offset, true)
const u32 = (data, offset) => new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset, true)
const set16 = (data, offset, value) => new DataView(data.buffer, data.byteOffset, data.byteLength).setUint16(offset, value, true)
const set32 = (data, offset, value) => new DataView(data.buffer, data.byteOffset, data.byteLength).setUint32(offset, value, true)
function archive(entries = { 'apple_health_export/export.xml': strToU8(xml(record())) }, level = 6) { return zipSync(entries, { level }) }
function directoryOffset(data) {
  for (let index = data.length - 22; index >= 0; index--) if (u32(data, index) === 0x06054b50) return { eocd: index, central: u32(data, index + 16) }
  throw new Error('Synthetic ZIP missing directory')
}

test('native XML preview retains only allowlisted selected records, with truthful skipped/malformed counts and no unrelated attributes', async () => {
  const result = await preview(xml(record(), record({ type: 'HKQuantityTypeIdentifierRestingHeartRate', value: '61.5' }),
    record({ type: 'HKQuantityTypeIdentifierStepCount', value: '999' }), record({ startDate: '2026-11-01 12:00:00 +0000' }),
    record({ unit: 'bpm' }), record({ startDate: '2026-02-30 12:00:00 +0000' }), record({ value: 'Infinity' }),
    record({ startDate: '2026-11-02 12:00:00', value: '69' })))
  assert.deepEqual(JSON.parse(JSON.stringify(result.stats)), { recordsSeen: 8, matched: 2, malformed: 4, skipped: 2 })
  assert.deepEqual([...result.records].map(row => row.metric), ['heart_rate', 'resting_heart_rate'])
  assert.equal(result.records[1].value, 61.5)
  assert.equal(result.records[0].startAt, '2026-11-02T12:00:00.000Z')
  assert.equal(result.range.startAt, '2026-11-02T12:00:00.000Z')
  assert.equal(result.range.endAt, '2026-11-02T12:00:05.000Z')
  assert.deepEqual([...result.sources], ['Synthetic Watch'])
  assert.doesNotMatch(JSON.stringify(result), /RAW_UNRELATED_SECRET|StepCount|secret/)
  assert.deepEqual(Object.keys(result.records[0]).sort(), ['creationAt','endAt','metric','sourceDevice','sourceName','sourceVersion','startAt','unit','value'].sort())
})

test('bounded native schema preamble is inert and remains compatible across chunk boundaries and UTF-8 sources', async () => {
  const declaration = '<!DOCTYPE HealthData [<!ELEMENT HealthData (Me?,Record*)><!ATTLIST HealthData locale CDATA #REQUIRED><!ELEMENT Me EMPTY><!ATTLIST Me secret CDATA #IMPLIED><!ELEMENT Record EMPTY><!ATTLIST Record type CDATA #REQUIRED>]>'
  const normal = xml(record({ sourceName: 'Synthetic café' })).replace('<HealthData', declaration + '<HealthData')
  assert.equal((await preview(normal)).records[0].sourceName, 'Synthetic café')
  const prefix = '<?xml version="1.0" encoding="UTF-8"?>'
  const commentLength = shared.APPLE_EXPORT_LIMITS.chunkBytes - prefix.length - 6
  const comment = '<!--' + 'a'.repeat(commentLength - 7) + '-->'
  const crossed = prefix + comment + declaration + '<HealthData>' + node(record()) + '</HealthData>'
  assert.equal((await preview(crossed)).stats.matched, 1)
})

test('an empty self-closing HealthData export yields an honest empty preview without invented coverage', async () => {
  const result = await preview('<?xml version="1.0" encoding="UTF-8"?><HealthData/>')
  assert.equal(result.records.length, 0)
  assert.equal(result.range, null)
  assert.equal(result.sources.length, 0)
  assert.deepEqual(JSON.parse(JSON.stringify(result.stats)), { recordsSeen: 0, matched: 0, malformed: 0, skipped: 0 })
})

test('selected-day timezone uses the true 23/25-hour DST windows and preserves distinct repeated-hour samples', async () => {
  const spring = await preview(xml(
    record({ startDate: '2026-03-08 05:59:59 +0000', endDate: '2026-03-08 05:59:59 +0000' }),
    record({ startDate: '2026-03-08 06:00:00 +0000', endDate: '2026-03-08 06:00:00 +0000' }),
    record({ startDate: '2026-03-09 04:59:59 +0000', endDate: '2026-03-09 04:59:59 +0000' }),
    record({ startDate: '2026-03-09 05:00:00 +0000', endDate: '2026-03-09 05:00:00 +0000' })), '2026-03-08', 'America/Chicago')
  assert.equal(spring.records.length, 2)
  const fall = await preview(xml(
    record({ startDate: '2026-11-01 01:30:00 -0500', endDate: '2026-11-01 01:30:00 -0500' }),
    record({ startDate: '2026-11-01 01:30:00 -0600', endDate: '2026-11-01 01:30:00 -0600' }),
    record({ startDate: '2026-11-02 05:59:59 +0000', endDate: '2026-11-02 05:59:59 +0000' }),
    record({ startDate: '2026-11-02 06:00:00 +0000', endDate: '2026-11-02 06:00:00 +0000' })), '2026-11-01', 'America/Chicago')
  assert.equal(fall.records.length, 3)
  assert.equal(new Set(fall.records.map(row => row.startAt)).size, 3)
})

test('DTD/entity/external references, malformed XML and unbounded tokens/depth fail closed without raw error disclosure', async () => {
  for (const content of [
    '<!DOCTYPE HealthData [<!ENTITY RAW_SECRET "private">]><HealthData>&RAW_SECRET;</HealthData>',
    '<!DOCTYPE HealthData SYSTEM "https://invalid.example/RAW_SECRET"><HealthData/>',
    '<!DOCTYPE HealthData PUBLIC "RAW_SECRET" "file:///private"><HealthData/>',
    '<!DOCTYPE HealthData [<!ELEMENT HealthData (Record*><!ELEMENT Record EMPTY>]><HealthData/>',
    '<!DOCTYPE HealthData [<!ELEMENT HealthData EMPTY>]><!DOCTYPE HealthData [<!ELEMENT HealthData EMPTY>]><HealthData/>',
    '<HealthData><!DOCTYPE HealthData [<!ELEMENT HealthData EMPTY>]></HealthData>',
    '<HealthData>&RAW_SECRET;</HealthData>', '<HealthData><![CDATA[RAW_SECRET]]></HealthData>',
    '<HealthData><Record></HealthData>', '<OtherRoot/>',
    '<HealthData><Record value="' + 'a'.repeat(shared.APPLE_EXPORT_LIMITS.xmlTokenChars + 1) + '"/></HealthData>',
    '<HealthData>' + '<Nested>'.repeat(shared.APPLE_EXPORT_LIMITS.xmlDepth + 1) + '</Nested>'.repeat(shared.APPLE_EXPORT_LIMITS.xmlDepth + 1) + '</HealthData>',
  ]) await expectError(preview(content))
  await expectError(parseAppleHealthExport(file(encoder.encode('<?xml version="1.0" encoding="UTF-16"?><HealthData/>')), '2026-11-02', 'UTC'), 'unsafe_xml')
})

test('stored and deflated ZIP exports parse only the approved XML entry while attachments stay outside the preview', async () => {
  for (const level of [0, 6]) {
    const bytes = archive({ 'apple_health_export/export.xml': strToU8(xml(record())),
      'apple_health_export/export_cda.xml': strToU8('<RAW_UNRELATED_SECRET/>'),
      'apple_health_export/workout-routes/route.gpx': strToU8('<route>RAW_UNRELATED_SECRET</route>') }, level)
    const result = await parseAppleHealthExport(file(bytes, 'export.zip'), '2026-11-02', 'UTC')
    assert.equal(result.stats.matched, 1)
    assert.doesNotMatch(JSON.stringify(result), /RAW_UNRELATED_SECRET|route|cda/)
  }
})

test('ambiguous/traversal/encrypted/unsupported/ZIP64/bomb/corrupt archives are rejected before a preview is returned', async () => {
  for (const entries of [
    { 'export.xml': strToU8(xml(record())), 'apple_health_export/export.xml': strToU8(xml(record())) },
    { '../export.xml': strToU8(xml(record())) },
    { 'apple_health_export/../export.xml': strToU8(xml(record())) },
    { '/export.xml': strToU8(xml(record())) },
    { 'other.xml': strToU8(xml(record())) },
  ]) await expectError(parseAppleHealthExport(file(archive(entries), 'export.zip'), '2026-11-02', 'UTC'))
  const mutations = [
    (data, central) => set16(data, central + 8, u16(data, central + 8) | 1),
    data => set16(data, 6, 1),
    (data, central) => set16(data, central + 10, 99),
    (data, central) => set16(data, central + 6, 45),
    (data, central) => set32(data, central + 24, 0xffffffff),
    (data, central) => set32(data, central + 24, 500 * 1024 * 1024),
    (data, central) => set32(data, central + 16, 123),
    (data, central) => set32(data, central + 42, central),
    data => { data[30] ^= 1 },
  ]
  for (const mutate of mutations) {
    const bytes = archive();const { central } = directoryOffset(bytes); mutate(bytes, central)
    await expectError(parseAppleHealthExport(file(bytes, 'export.zip'), '2026-11-02', 'UTC'))
  }
  const original = archive(), position = directoryOffset(original)
  const padded = new Uint8Array(original.length + 1)
  padded.set(original.subarray(0, position.central));padded.set(original.subarray(position.central), position.central + 1)
  set32(padded, position.eocd + 1 + 16, position.central + 1)
  await expectError(parseAppleHealthExport(file(padded, 'export.zip'), '2026-11-02', 'UTC'))
  const broken = archive();broken[40 + u16(broken, 26)] ^= 0xff
  await expectError(parseAppleHealthExport(file(broken, 'export.zip'), '2026-11-02', 'UTC'))
})

test('technical file/entry/record/selection bounds reject rather than truncate or fall back to upload', async () => {
  let reads = 0
  await expectError(parseAppleHealthExport({ name: 'export.xml', size: shared.APPLE_EXPORT_LIMITS.uncompressedBytes + 1,
    slice() { reads++; throw new Error('Must not read oversize file') } }, '2026-11-02', 'UTC'), 'oversized')
  assert.equal(reads, 0)
  await expectError(parseAppleHealthExport({ name: 'export.zip', size: shared.APPLE_EXPORT_LIMITS.compressedBytes + 1,
    slice(start, end) { assert.equal(start, 0);assert.equal(end, 4);return new Blob([new Uint8Array([80, 75, 3, 4])]) } }, '2026-11-02', 'UTC'), 'oversized')
  const limited = loadParser({ records: 2, selectedRecords: 1, xmlElements: 100, zipEntries: 1 })
  await expectError(limited.parseAppleHealthExport(file(xml(record(), record({ value: '73' }))), '2026-11-02', 'UTC'), 'oversized')
  await expectError(limited.parseAppleHealthExport(file(xml(record({ type: 'Other' }), record({ type: 'Other' }), record({ type: 'Other' }))), '2026-11-02', 'UTC'), 'oversized')
  await expectError(limited.parseAppleHealthExport(file(archive({ 'export.xml': strToU8(xml(record())), 'extra.txt': strToU8('extra') }), 'export.zip'), '2026-11-02', 'UTC'), 'oversized')
  for (const [date, timezone] of [['2026-02-30','UTC'], ['2026-11-02','Unknown/Zone']]) await expectError(preview(xml(record()), date, timezone), 'invalid_selection')
})

test('large XML is consumed through bounded slices with responsive byte progress and cancellable parsing, without whole-file access', async () => {
  const content = xml(...Array.from({ length: 1500 }, (_, index) => record({ value: String(60 + index % 10) })))
  const original = file(content), reads = [], progress = []
  const wrapped = { name: original.name, size: original.size, arrayBuffer() { assert.fail('No whole-file buffer') },
    slice(start, end) { reads.push(end - start);return original.slice(start, end) } }
  const result = await parseAppleHealthExport(wrapped, '2026-11-02', 'UTC', { onProgress: (bytes, total) => progress.push([bytes, total]) })
  assert.equal(result.records.length, 1500)
  assert.ok(reads.length > 2)
  assert.ok(Math.max(...reads) <= shared.APPLE_EXPORT_LIMITS.chunkBytes)
  assert.equal(progress.at(-1)[0], original.size)
  assert.ok(progress.every(([bytes, total], index) => total === original.size && (!index || bytes > progress[index - 1][0])))
  const controller = new AbortController();controller.abort()
  await expectError(parseAppleHealthExport(original, '2026-11-02', 'UTC', { signal: controller.signal }), 'cancelled')
  const during = new AbortController()
  await expectError(parseAppleHealthExport(original, '2026-11-02', 'UTC', { signal: during.signal, onProgress() { during.abort() } }), 'cancelled')
})

test('worker protocol throttles actual progress, fences stale results and respects cancellation without exposing parser errors', async () => {
  const calls = [], messages = []
  class SafeError extends Error { constructor(code) { super('Safe local parsing error.');this.code = code } }
  const context = { AbortController, Date: { now: () => 0 }, postMessage: message => messages.push(message),
    require(name) {
      if (name === './limits') return { AppleExportParseError: SafeError }
      if (name === './parser') return { parseAppleHealthExport(_file, _date, _timezone, options) {
        let resolve, reject
        const promise = new Promise((yes, no) => { resolve = yes; reject = no })
        calls.push({ options, resolve, reject });return promise
      } }
      throw new Error('Unexpected worker dependency')
    } }
  const source = ts.transpileModule(readFileSync('lib/health/appleExport/parser.worker.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  runInNewContext(source, { ...context, exports: {}, get onmessage() { return context.onmessage }, set onmessage(value) { context.onmessage = value } })
  const start = () => context.onmessage({ data: { type: 'start', file: {}, date: '2026-11-02', timezone: 'UTC' } })
  const flush = () => new Promise(setImmediate)
  start()
  for (let bytes = 1; bytes <= 1000; bytes++) calls[0].options.onProgress(bytes, 1000)
  assert.equal(messages.filter(message => message.type === 'progress').length, 1)
  assert.equal(messages[0].bytes, 1000)
  calls[0].resolve({ records: [], stats: {}, range: null, sources: [] });await flush()
  assert.equal(messages.filter(message => message.type === 'preview').length, 1)
  start();start()
  assert.equal(calls[1].options.signal.aborted, true)
  calls[1].resolve({ records: ['RAW_SECRET'] })
  context.onmessage({ data: { type: 'cancel' } })
  assert.equal(calls[2].options.signal.aborted, true)
  calls[2].resolve({ records: ['RAW_SECRET'] });await flush()
  assert.equal(messages.filter(message => message.type === 'preview').length, 1)
  start();calls[3].reject(new Error('RAW_SECRET'));await flush()
  assert.equal(messages.at(-1).type, 'error')
  assert.equal(messages.at(-1).code, 'invalid_xml')
  assert.doesNotMatch(JSON.stringify(messages), /RAW_SECRET/)
})
