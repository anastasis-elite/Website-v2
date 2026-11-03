import { Inflate } from 'fflate'
import { APPLE_EXPORT_LIMITS as limits } from './shared'
import { AppleExportParseError, assertNotCancelled } from './limits'

type Entry = { name: string; version: number; flags: number; method: number; crc: number; compressed: number; uncompressed: number; offset: number; dataStart: number; end: number }
const u16 = (data: Uint8Array, offset: number) => new DataView(data.buffer, data.byteOffset, data.byteLength).getUint16(offset, true)
const u32 = (data: Uint8Array, offset: number) => new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset, true)
const invalid = () => new AppleExportParseError('invalid_zip')
const unsupported = () => new AppleExportParseError('unsupported_zip')
const oversized = () => new AppleExportParseError('oversized')
const knownExport = (name: string) => name === 'export.xml' || name === 'apple_health_export/export.xml'

async function read(file: Blob, start: number, length: number, signal?: AbortSignal) {
  assertNotCancelled(signal)
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(length) || start < 0 || length < 0 || start + length > file.size) throw invalid()
  const bytes = new Uint8Array(await file.slice(start, start + length).arrayBuffer())
  assertNotCancelled(signal)
  if (bytes.length !== length) throw invalid()
  return bytes
}

function nameOf(bytes: Uint8Array, flags: number) {
  if (!bytes.length || bytes.length > 4096) throw unsupported()
  if (!(flags & 0x800) && bytes.some(byte => byte > 127)) throw unsupported()
  let name: string
  try { name = new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { throw unsupported() }
  if (name.length > 1024 || /[\u0000-\u001f\\:]/.test(name) || name.startsWith('/')) throw unsupported()
  const parts = name.endsWith('/') ? name.slice(0, -1).split('/') : name.split('/')
  if (parts.some(part => !part || part === '.' || part === '..')) throw unsupported()
  return name
}

function checkExtras(bytes: Uint8Array) {
  for (let cursor = 0; cursor < bytes.length;) {
    if (cursor + 4 > bytes.length) throw invalid()
    const kind = u16(bytes, cursor), length = u16(bytes, cursor + 2)
    if (cursor + 4 + length > bytes.length) throw invalid()
    if (kind === 1 || kind === 0x9901) throw unsupported() // ZIP64 / AES
    cursor += 4 + length
  }
}

/** Inspect bounded archive metadata, then read only the single approved entry.
 * Attachments are never decompressed or extracted. */
async function exportEntry(file: Blob, signal?: AbortSignal): Promise<Entry> {
  if (file.size < 22) throw invalid()
  const tailLength = Math.min(file.size, 65557), tailStart = file.size - tailLength
  const tail = await read(file, tailStart, tailLength, signal)
  let eocd = -1
  for (let cursor = tail.length - 22; cursor >= 0; cursor--) {
    if (u32(tail, cursor) === 0x06054b50 && cursor + 22 + u16(tail, cursor + 20) === tail.length) { eocd = cursor; break }
  }
  if (eocd < 0) throw invalid()
  const count = u16(tail, eocd + 10), directorySize = u32(tail, eocd + 12), directoryStart = u32(tail, eocd + 16)
  if (u16(tail, eocd + 4) || u16(tail, eocd + 6) || u16(tail, eocd + 8) !== count) throw unsupported()
  if (count === 0xffff || directorySize === 0xffffffff || directoryStart === 0xffffffff) throw unsupported()
  if (!count || count > limits.zipEntries || directorySize > limits.zipDirectoryBytes) throw oversized()
  if (directoryStart + directorySize !== tailStart + eocd) throw invalid()
  const directory = await read(file, directoryStart, directorySize, signal)
  const entries: Entry[] = [], names = new Set<string>()
  let cursor = 0, totalUncompressed = 0
  for (let index = 0; index < count; index++) {
    assertNotCancelled(signal)
    if (cursor + 46 > directory.length || u32(directory, cursor) !== 0x02014b50) throw invalid()
    const version = u16(directory, cursor + 6), flags = u16(directory, cursor + 8), method = u16(directory, cursor + 10)
    const crc = u32(directory, cursor + 16), compressed = u32(directory, cursor + 20), uncompressed = u32(directory, cursor + 24)
    const nameLength = u16(directory, cursor + 28), extraLength = u16(directory, cursor + 30), commentLength = u16(directory, cursor + 32)
    const offset = u32(directory, cursor + 42), next = cursor + 46 + nameLength + extraLength + commentLength
    if (next > directory.length) throw invalid()
    if (version > 20 || flags & ~0x080e || method !== 0 && method !== 8 || method === 0 && flags & 6 || u16(directory, cursor + 34)) throw unsupported()
    if ([compressed, uncompressed, offset].includes(0xffffffff)) throw unsupported()
    if (uncompressed > limits.uncompressedBytes || uncompressed > Math.max(1, compressed) * limits.zipCompressionRatio) throw oversized()
    totalUncompressed += uncompressed
    if (totalUncompressed > limits.uncompressedBytes) throw oversized()
    if (method === 0 && compressed !== uncompressed || !compressed && uncompressed) throw invalid()
    const name = nameOf(directory.subarray(cursor + 46, cursor + 46 + nameLength), flags)
    if (names.has(name)) throw unsupported()
    names.add(name)
    checkExtras(directory.subarray(cursor + 46 + nameLength, cursor + 46 + nameLength + extraLength))
    entries.push({ name, version, flags, method, crc, compressed, uncompressed, offset, dataStart: 0, end: 0 })
    cursor = next
  }
  if (cursor !== directory.length) throw invalid()
  const targets = entries.filter(entry => knownExport(entry.name))
  if (targets.length !== 1) throw unsupported()
  for (const entry of entries) {
    const local = await read(file, entry.offset, 30, signal)
    if (u32(local, 0) !== 0x04034b50 || u16(local, 4) !== entry.version || u16(local, 6) !== entry.flags || u16(local, 8) !== entry.method) throw invalid()
    const nameLength = u16(local, 26), extraLength = u16(local, 28)
    if (nameLength > 4096 || extraLength > 65535) throw unsupported()
    const details = await read(file, entry.offset + 30, nameLength + extraLength, signal)
    if (nameOf(details.subarray(0, nameLength), entry.flags) !== entry.name) throw invalid()
    checkExtras(details.subarray(nameLength))
    entry.dataStart = entry.offset + 30 + nameLength + extraLength
    entry.end = entry.dataStart + entry.compressed
    if (entry.end > directoryStart) throw invalid()
    if (!(entry.flags & 8)) {
      if (u32(local, 14) !== entry.crc || u32(local, 18) !== entry.compressed || u32(local, 22) !== entry.uncompressed) throw invalid()
    } else {
      const localCrc = u32(local, 14), localCompressed = u32(local, 18), localUncompressed = u32(local, 22)
      if (localCrc && localCrc !== entry.crc || localCompressed && localCompressed !== entry.compressed || localUncompressed && localUncompressed !== entry.uncompressed) throw invalid()
      const descriptor = await read(file, entry.end, Math.min(16, directoryStart - entry.end), signal)
      if (descriptor.length < 12) throw invalid()
      const prefix = u32(descriptor, 0) === 0x08074b50 ? 4 : 0
      if (descriptor.length < prefix + 12 || u32(descriptor, prefix) !== entry.crc || u32(descriptor, prefix + 4) !== entry.compressed || u32(descriptor, prefix + 8) !== entry.uncompressed) throw invalid()
      entry.end += prefix + 12
    }
  }
  const ordered = [...entries].sort((left, right) => left.offset - right.offset)
  for (let index = 0; index < ordered.length; index++) {
    if (ordered[index].offset !== (index ? ordered[index - 1].end : 0) || ordered[index].end > directoryStart) throw invalid()
  }
  if (ordered[ordered.length - 1].end !== directoryStart) throw invalid()
  return targets[0]
}

const crcTable = Array.from({ length: 256 }, (_, number) => {
  let value = number
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1
  return value >>> 0
})

export async function readZipExport(file: Blob, onChunk: (bytes: Uint8Array, final: boolean) => void, options: {
  signal?: AbortSignal; onProgress?: (bytes: number, total: number) => void
} = {}) {
  const entry = await exportEntry(file, options.signal)
  let produced = 0, crc = 0xffffffff, compressedWithoutOutput = 0
  const output = (bytes: Uint8Array, final: boolean) => {
    assertNotCancelled(options.signal)
    if (bytes.length) compressedWithoutOutput = 0
    produced += bytes.length
    if (produced > entry.uncompressed || produced > limits.uncompressedBytes) throw oversized()
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8
    if (!bytes.length) onChunk(bytes, final)
    for (let offset = 0; offset < bytes.length; offset += limits.chunkBytes) onChunk(bytes.subarray(offset, offset + limits.chunkBytes), final && offset + limits.chunkBytes >= bytes.length)
  }
  const inflater = entry.method === 8 ? new Inflate(output) : null
  try {
    for (let offset = 0; offset < entry.compressed; offset += limits.zipInflateChunkBytes) {
      const size = Math.min(limits.zipInflateChunkBytes, entry.compressed - offset)
      // Inflate can retain input after a completed stream. Bound subsequent
      // pushes that produce no bytes, including empty callbacks, before reading
      // another chunk. Pathological long empty-block streams are unsupported.
      if (inflater && compressedWithoutOutput + size > limits.zipNoOutputBytes) throw unsupported()
      const bytes = await read(file, entry.dataStart + offset, size, options.signal)
      const final = offset + size === entry.compressed
      if (inflater) { compressedWithoutOutput += size; inflater.push(bytes, final) }
      else output(bytes, final)
      options.onProgress?.(offset + size, entry.compressed)
    }
    if (!entry.compressed) output(new Uint8Array(), true)
  } catch (error) {
    if (error instanceof AppleExportParseError) throw error
    throw invalid()
  }
  if (produced !== entry.uncompressed || ((crc ^ 0xffffffff) >>> 0) !== entry.crc) throw invalid()
}
