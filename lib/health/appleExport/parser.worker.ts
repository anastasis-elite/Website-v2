import { parseAppleHealthExport } from './parser'
import { AppleExportParseError } from './limits'

type Message = { type: 'start'; file: File; date: string; timezone: string } | { type: 'cancel' }
const scope = globalThis as typeof globalThis & { onmessage: ((event: MessageEvent<Message>) => void) | null; postMessage: (value: unknown) => void }
let active: AbortController | null = null

scope.onmessage = event => {
  const message = event.data
  if (message?.type === 'cancel') { active?.abort(); return }
  if (message?.type !== 'start') return
  active?.abort()
  const controller = new AbortController(); active = controller
  let lastBytes = 0, lastProgressAt = Date.now()
  void parseAppleHealthExport(message.file, message.date, message.timezone, {
    signal: controller.signal,
    onProgress: (bytes, total) => {
      if (active !== controller || controller.signal.aborted) return
      const now = Date.now()
      if (bytes !== total && bytes - lastBytes < 256 * 1024 && now - lastProgressAt < 100) return
      lastBytes = bytes; lastProgressAt = now
      scope.postMessage({ type: 'progress', bytes, total })
    },
  }).then(preview => {
    if (active === controller && !controller.signal.aborted) scope.postMessage({ type: 'preview', preview })
  }).catch(error => {
    if (active !== controller || controller.signal.aborted) return
    const safe = error instanceof AppleExportParseError ? error : new AppleExportParseError('invalid_xml')
    scope.postMessage({ type: 'error', code: safe.code, error: safe.message })
  }).finally(() => { if (active === controller) active = null })
}
