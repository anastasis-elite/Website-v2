import { APPLE_EXPORT_LIMITS as limits, validateExportSelection, type ExportPreview } from './shared'
import { AppleExportParseError, assertNotCancelled } from './limits'
import { appleExportXmlReader } from './xml'
import { readZipExport } from './zip'

export async function parseAppleHealthExport(file: Blob & { name?: string }, date: string, timezone: string, options: {
  signal?: AbortSignal; onProgress?: (bytes: number, total: number) => void
} = {}): Promise<ExportPreview> {
  const selection = validateExportSelection(date, timezone)
  if (!selection) throw new AppleExportParseError('invalid_selection')
  assertNotCancelled(options.signal)
  if (!file || typeof file.slice !== 'function' || !Number.isSafeInteger(file.size) || !file.size) throw new AppleExportParseError('unsupported_file')
  if (file.size > limits.uncompressedBytes) throw new AppleExportParseError('oversized')
  const magic = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  assertNotCancelled(options.signal)
  const isZip = magic.length === 4 && magic[0] === 80 && magic[1] === 75 && magic[2] === 3 && magic[3] === 4
  if (isZip && file.size > limits.compressedBytes) throw new AppleExportParseError('oversized')
  const reader = appleExportXmlReader(selection, options.signal)
  if (isZip) await readZipExport(file, (bytes, final) => reader.push(bytes, final), options)
  else {
    if (file.name && !file.name.toLowerCase().endsWith('.xml')) throw new AppleExportParseError('unsupported_file')
    for (let offset = 0; offset < file.size; offset += limits.chunkBytes) {
      assertNotCancelled(options.signal)
      const size = Math.min(limits.chunkBytes, file.size - offset)
      const bytes = new Uint8Array(await file.slice(offset, offset + size).arrayBuffer())
      if (bytes.length !== size) throw new AppleExportParseError('invalid_xml')
      reader.push(bytes, offset + size === file.size)
      options.onProgress?.(offset + size, file.size)
    }
  }
  assertNotCancelled(options.signal)
  return reader.result()
}
