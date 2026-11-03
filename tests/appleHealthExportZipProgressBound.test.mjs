import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname, extname } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const fflate = require('fflate')
const encoder = new TextEncoder()
const record = '<Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Synthetic Watch" unit="count/min" value="72" startDate="2026-11-02 12:00:00 +0000" endDate="2026-11-02 12:00:00 +0000"/>'
const tinyXml = encoder.encode(`<HealthData>${record}</HealthData>`)

function loadParser(outputCalls = []) {
  const modules = new Map()
  class ObservedInflate extends fflate.Inflate {
    constructor(callback) {
      super((bytes, final) => { outputCalls.push({ bytes: bytes.length, final }); callback(bytes, final) })
    }
  }
  function load(path) {
    path = resolve(path)
    if (modules.has(path)) return modules.get(path).exports
    const module = { exports: {} }; modules.set(path, module)
    const source = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText
    runInNewContext(source, { module, exports: module.exports, Date, Map, Set, Intl, TextEncoder, TextDecoder,
      AbortController, Uint8Array, DataView, Blob, File,
      console: { log() { assert.fail('No health logging') }, error() { assert.fail('No health logging') } },
      fetch() { assert.fail('The archive must stay local') },
      require(name) {
        if (name === 'fflate') return { ...fflate, Inflate: ObservedInflate }
        const target = name.startsWith('@/') ? resolve(name.slice(2)) : name.startsWith('.') ? resolve(dirname(path), name) : null
        return target ? load(extname(target) ? target : target + '.ts') : require(name)
      },
    }, { filename: path })
    return module.exports
  }
  return { ...load('lib/health/appleExport/parser.ts'), limits: load('lib/health/appleExport/shared.ts').APPLE_EXPORT_LIMITS }
}

const crcTable = Array.from({ length: 256 }, (_, initial) => {
  let value = initial
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1
  return value >>> 0
})
function crc32(bytes) {
  let value = 0xffffffff
  for (const byte of bytes) value = crcTable[(value ^ byte) & 255] ^ value >>> 8
  return (value ^ 0xffffffff) >>> 0
}

/** Build coherent method-8 metadata around supplied raw DEFLATE bytes. The CRC
 * and uncompressed size describe the XML, including when the compressed size
 * deliberately includes an otherwise ignored suffix. */
function archive(payload, compressed) {
  const name = encoder.encode('export.xml'), dataStart = 30 + name.length
  const dataEnd = dataStart + compressed.length, centralSize = 46 + name.length
  const bytes = new Uint8Array(dataEnd + centralSize + 22), view = new DataView(bytes.buffer)
  const put16 = (offset, value) => view.setUint16(offset, value, true)
  const put32 = (offset, value) => view.setUint32(offset, value, true)
  const crc = crc32(payload)
  put32(0, 0x04034b50); put16(4, 20); put16(8, 8)
  put32(14, crc); put32(18, compressed.length); put32(22, payload.length); put16(26, name.length)
  bytes.set(name, 30); bytes.set(compressed, dataStart)
  put32(dataEnd, 0x02014b50); put16(dataEnd + 4, 20); put16(dataEnd + 6, 20); put16(dataEnd + 10, 8)
  put32(dataEnd + 16, crc); put32(dataEnd + 20, compressed.length); put32(dataEnd + 24, payload.length)
  put16(dataEnd + 28, name.length); bytes.set(name, dataEnd + 46)
  const eocd = dataEnd + centralSize
  put32(eocd, 0x06054b50); put16(eocd + 8, 1); put16(eocd + 10, 1)
  put32(eocd + 12, centralSize); put32(eocd + 16, dataEnd)
  const file = new File([bytes], 'export.zip'), reads = []
  return {
    compressedLength: compressed.length,
    file: { name: file.name, size: file.size, arrayBuffer() { assert.fail('No whole-archive buffering') },
      slice(start, end) { reads.push({ start, end }); return file.slice(start, end) } },
    // Metadata inspection intentionally reads a bounded tail and headers too;
    // count only decoder-input slices, not those overlapping metadata reads.
    compressedReads(chunkBytes) { return reads.filter(read => read.start >= dataStart && read.end <= dataEnd && read.end - read.start <= chunkBytes) },
  }
}

function storedBlock(payload, final = true) {
  assert.ok(payload.length <= 65535)
  const bytes = new Uint8Array(payload.length + 5), view = new DataView(bytes.buffer)
  bytes[0] = final ? 1 : 0
  view.setUint16(1, payload.length, true); view.setUint16(3, payload.length ^ 0xffff, true)
  bytes.set(payload, 5)
  return bytes
}

test('a short valid DEFLATE stream with a coherent long padded suffix is rejected after bounded decoder reads', async () => {
  const output = [], { parseAppleHealthExport, limits } = loadParser(output)
  assert.equal(limits.zipNoOutputBytes, 128 * 1024)
  const valid = fflate.deflateSync(tinyXml), padding = new Uint8Array(limits.zipNoOutputBytes * 4)
  const compressed = new Uint8Array(valid.length + padding.length)
  compressed.set(valid); compressed.set(padding, valid.length)
  const zipped = archive(tinyXml, compressed)
  await assert.rejects(parseAppleHealthExport(zipped.file, '2026-11-02', 'UTC'), error =>
    error.name === 'AppleExportParseError' && ['unsupported_zip', 'oversized'].includes(error.code))
  assert.ok(output.some(call => call.bytes > 0), 'The valid XML was decoded before the padded no-output suffix.')
  const reads = zipped.compressedReads(limits.zipInflateChunkBytes)
  const total = reads.reduce((sum, read) => sum + read.end - read.start, 0)
  assert.ok(total <= limits.zipNoOutputBytes + limits.zipInflateChunkBytes, `Decoder read ${total} compressed bytes before rejecting.`)
  assert.ok(total < zipped.compressedLength, 'The remaining suffix must not be read or silently accepted.')
})

test('a valid maximal 65,535-byte DEFLATE stored block inside a method-8 ZIP still previews completely', async () => {
  const output = [], { parseAppleHealthExport } = loadParser(output)
  const prefix = `<HealthData>${record}<!--`, suffix = '--></HealthData>'
  const payload = encoder.encode(prefix + 'x'.repeat(65535 - prefix.length - suffix.length) + suffix)
  assert.equal(payload.length, 65535)
  const zipped = archive(payload, storedBlock(payload))
  const preview = await parseAppleHealthExport(zipped.file, '2026-11-02', 'UTC')
  assert.equal(preview.records.length, 1)
  assert.equal(preview.records[0].value, 72)
  assert.equal(preview.records[0].startAt, '2026-11-02T12:00:00.000Z')
  assert.equal(output.reduce((sum, call) => sum + call.bytes, 0), payload.length, 'The XML must not be truncated.')
  assert.ok(output.some(call => call.final), 'The valid decoder stream must reach its actual final input.')
})

test('empty-output callbacks cannot reset the compressed-input budget for pathological empty-block streams', async () => {
  const output = [], { parseAppleHealthExport, limits } = loadParser(output)
  const empty = storedBlock(new Uint8Array(), false)
  const count = Math.ceil((limits.zipNoOutputBytes + limits.zipInflateChunkBytes) / empty.length)
  const final = storedBlock(tinyXml), compressed = new Uint8Array(count * empty.length + final.length)
  for (let index = 0; index < count; index++) compressed.set(empty, index * empty.length)
  compressed.set(final, count * empty.length)
  const zipped = archive(tinyXml, compressed)
  await assert.rejects(parseAppleHealthExport(zipped.file, '2026-11-02', 'UTC'), error =>
    error.name === 'AppleExportParseError' && ['unsupported_zip', 'oversized'].includes(error.code))
  assert.ok(output.some(call => call.bytes === 0), 'Exercise the empty callbacks that must not count as progress.')
  assert.equal(output.some(call => call.bytes > 0), false)
  const total = zipped.compressedReads(limits.zipInflateChunkBytes).reduce((sum, read) => sum + read.end - read.start, 0)
  assert.ok(total <= limits.zipNoOutputBytes, `Empty blocks consumed ${total} bytes without output.`)
})
