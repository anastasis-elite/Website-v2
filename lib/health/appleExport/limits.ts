export type ExportParseCode = 'unsupported_file' | 'oversized' | 'invalid_zip' | 'unsupported_zip' | 'invalid_xml' | 'unsafe_xml' | 'cancelled' | 'invalid_selection'
const messages: Record<ExportParseCode, string> = {
  unsupported_file: 'Choose an Apple Health export.xml file or its ZIP export.',
  oversized: 'This export exceeds the supported processing limits. Nothing has been uploaded. Choose a smaller export or contact support.',
  invalid_zip: 'The ZIP export could not be verified. Nothing has been uploaded.',
  unsupported_zip: 'This ZIP uses an unsupported or unsafe archive format. Choose the original unencrypted Apple Health export.',
  invalid_xml: 'The XML export is malformed or uses an unsupported encoding. Nothing has been uploaded.',
  unsafe_xml: 'The XML contains unsupported declarations or entities. Nothing has been uploaded.',
  cancelled: 'Preview cancelled. Nothing has been uploaded.',
  invalid_selection: 'Choose a valid day and timezone before previewing.',
}

export class AppleExportParseError extends Error {
  constructor(public readonly code: ExportParseCode) { super(messages[code]); this.name = 'AppleExportParseError' }
}

export function assertNotCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new AppleExportParseError('cancelled')
}
