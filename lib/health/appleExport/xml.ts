import { SaxesParser } from 'saxes'
import { APPLE_EXPORT_LIMITS as limits, normalizeAppleRecord, type ExportPreview, type ExportSelection } from './shared'
import { AppleExportParseError, assertNotCancelled } from './limits'

const unsafe = () => new AppleExportParseError('unsafe_xml')
const malformed = () => new AppleExportParseError('invalid_xml')
const name = /^[A-Za-z_][A-Za-z0-9_.:-]*/

function elementModel(value: string) {
  if (value === 'EMPTY' || value === 'ANY') return true
  // The native schema uses bounded XML child-content models, never entities.
  if (/^\(\s*#PCDATA(?:\s*\|\s*[A-Za-z_][A-Za-z0-9_.:-]*)*\s*\)\*?$/.test(value)) return true
  let cursor = 0
  const space = () => { while (/\s/.test(value[cursor] || '') && cursor < value.length) cursor++ }
  const particle = (depth = 0): boolean => {
    if (depth > 64) return false
    space()
    if (value[cursor] === '(') {
      cursor++; if (!particle(depth + 1)) return false
      space(); let separator = ''
      while (value[cursor] === ',' || value[cursor] === '|') {
        const next = value[cursor++]
        if (separator && separator !== next) return false
        separator = next
        if (!particle(depth + 1)) return false
        space()
      }
      if (value[cursor++] !== ')') return false
    } else {
      const match = name.exec(value.slice(cursor)); if (!match) return false
      cursor += match[0].length
    }
    if (['?', '*', '+'].includes(value[cursor] || '')) cursor++
    space(); return true
  }
  return value.startsWith('(') && particle() && cursor === value.length
}

function attributeList(value: string) {
  let remaining = value.trim()
  const element = name.exec(remaining); if (!element) return false
  remaining = remaining.slice(element[0].length)
  while (remaining.trim()) {
    if (!/^\s+/.test(remaining)) return false
    remaining = remaining.trimStart()
    const attribute = name.exec(remaining); if (!attribute) return false
    remaining = remaining.slice(attribute[0].length)
    if (!/^\s+/.test(remaining)) return false
    remaining = remaining.trimStart()
    const type = /^(?:CDATA|IDREFS?|ID|NMTOKENS?)(?=\s)|^\(\s*[A-Za-z0-9_.:-]+(?:\s*\|\s*[A-Za-z0-9_.:-]+)*\s*\)(?=\s)/.exec(remaining)
    if (!type) return false
    remaining = remaining.slice(type[0].length).trimStart()
    const keyword = /^#(?:REQUIRED|IMPLIED)(?=\s|$)/.exec(remaining)
    if (keyword) { remaining = remaining.slice(keyword[0].length); continue }
    if (/^#FIXED\s+/.test(remaining)) remaining = remaining.replace(/^#FIXED\s+/, '')
    const literal = /^(?:"[^"&%<>]*"|'[^'&%<>]*')/.exec(remaining)
    if (!literal) return false
    remaining = remaining.slice(literal[0].length)
  }
  return true
}

/** Native HealthData exports include schema declarations. Discard this exact
 * declaration category without configuring a DTD resolver or expanding it. */
function validateNativeSchema(declaration: string) {
  if (declaration.length > limits.xmlTokenChars || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]|\b(?:ENTITY|SYSTEM|PUBLIC)\b|%|&/.test(declaration)) throw unsafe()
  const match = /^<!DOCTYPE\s+HealthData\s*\[([\s\S]*)\]\s*>$/.exec(declaration)
  if (!match) throw unsafe()
  let body = match[1].trim(), count = 0
  while (body) {
    const start = /^<!(ELEMENT|ATTLIST)\s+/.exec(body)
    if (!start || ++count > 256) throw unsafe()
    let quote = '', end = -1
    for (let index = start[0].length; index < body.length; index++) {
      const character = body[index]
      if (quote) { if (character === quote) quote = '' }
      else if (character === '"' || character === "'") quote = character
      else if (character === '>') { end = index; break }
      else if (character === '<') throw unsafe()
    }
    if (end < 0 || quote) throw unsafe()
    const content = body.slice(start[0].length, end).trim()
    if (start[1] === 'ELEMENT') {
      const element = name.exec(content)
      if (!element || !/^\s+/.test(content.slice(element[0].length)) || !elementModel(content.slice(element[0].length).trim())) throw unsafe()
    } else if (!attributeList(content)) throw unsafe()
    body = body.slice(end + 1).trim()
  }
  if (!count) throw unsafe()
}

/** Keep only a bounded preamble. A native internal schema is accepted only as
 * inert ELEMENT/ATTLIST syntax; entities and external identifiers are rejected. */
function nativePreamble(write: (text: string) => void) {
  let pending = '', done = false, schemaSeen = false, declarationSeen = false
  return (text: string, final: boolean) => {
    if (done) { write(text); return }
    pending += text
    if (pending.length > limits.xmlTokenChars + limits.chunkBytes) throw new AppleExportParseError('oversized')
    while (pending) {
      const whitespace = /^(?:\uFEFF)?\s*/.exec(pending)![0]
      if (whitespace) { write(whitespace); pending = pending.slice(whitespace.length); if (!pending) break }
      if (pending.startsWith('<?')) {
        const end = pending.indexOf('?>')
        if (end < 0) break
        const instruction = pending.slice(0, end + 2)
        if (declarationSeen || schemaSeen || !/^<\?xml\s/.test(instruction) || /encoding\s*=\s*(["'])(?!UTF-8\1)/i.test(instruction)) throw unsafe()
        declarationSeen = true; write(instruction); pending = pending.slice(end + 2); continue
      }
      if (pending.startsWith('<!--')) {
        const end = pending.indexOf('-->')
        if (end < 0) break
        write(pending.slice(0, end + 3)); pending = pending.slice(end + 3); continue
      }
      if (pending.startsWith('<!DOCTYPE')) {
        if (schemaSeen) throw unsafe()
        let quote = '', brackets = 0, end = -1
        for (let index = 9; index < pending.length; index++) {
          const character = pending[index]
          if (quote) { if (character === quote) quote = '' }
          else if (character === '"' || character === "'") quote = character
          else if (character === '[') brackets++
          else if (character === ']') { if (--brackets < 0) throw unsafe() }
          else if (character === '>' && brackets === 0) { end = index; break }
        }
        if (end < 0) break
        validateNativeSchema(pending.slice(0, end + 1))
        schemaSeen = true; pending = pending.slice(end + 1); continue
      }
      if (/^<HealthData(?=\s|\/|>)/.test(pending)) { done = true; write(pending); pending = ''; break }
      // A partial prefix can cross a File.slice/decoder boundary.
      if (['<?xml', '<!--', '<!DOCTYPE', '<HealthData'].some(prefix => prefix.startsWith(pending))) break
      throw malformed()
    }
    if (final && !done) throw malformed()
  }
}

/** Prevent SAX from accumulating an unbounded tag, text, comment or CDATA. */
function tokenGuard() {
  let mode: 'text' | 'tag' | 'comment' = 'text', quote = '', token = 0, prefix = '', suffix = ''
  return (text: string) => {
    for (const character of text) {
      if (++token > limits.xmlTokenChars) throw new AppleExportParseError('oversized')
      if (mode === 'comment') {
        suffix = (suffix + character).slice(-3)
        if (suffix === '-->') { mode = 'text'; token = 0; suffix = '' }
      } else if (mode === 'text') {
        if (character === '<') { mode = 'tag'; prefix = '<'; token = 1 }
      } else {
        if (prefix.length < 10) {
          prefix += character
          if (prefix === '<!--') { mode = 'comment'; suffix = ''; continue }
          if (prefix.startsWith('<![CDATA[') || prefix === '<!DOCTYPE') throw unsafe()
        }
        if (quote) { if (character === quote) quote = '' }
        else if (character === '"' || character === "'") quote = character
        else if (character === '>') { mode = 'text'; token = 0 }
      }
    }
  }
}

export function appleExportXmlReader(selection: ExportSelection, signal?: AbortSignal) {
  const preview: ExportPreview = { records: [], stats: { recordsSeen: 0, matched: 0, malformed: 0, skipped: 0 }, range: null, sources: [] }
  const sources = new Set<string>(), parser = new SaxesParser({ xmlns: false, fragment: false })
  let depth = 0, elements = 0, rootClosed = false, rootSeen = false, bytesRead = 0
  parser.on('error', () => { throw malformed() })
  parser.on('doctype', () => { throw unsafe() })
  parser.on('opentag', tag => {
    assertNotCancelled(signal)
    if (++elements > limits.xmlElements || depth >= limits.xmlDepth) throw new AppleExportParseError('oversized')
    if (!depth) { if (rootSeen || tag.name !== 'HealthData') throw malformed(); rootSeen = true }
    depth++
    if (tag.name !== 'Record') return
    preview.stats.recordsSeen++
    if (preview.stats.recordsSeen > limits.records) throw new AppleExportParseError('oversized')
    if (depth !== 2) { preview.stats.skipped++; return }
    const result = normalizeAppleRecord(tag.attributes as Record<string, string>, selection.date, selection.timezone, selection)
    if (result.kind !== 'matched') { preview.stats[result.kind]++; return }
    if (preview.records.length >= limits.selectedRecords) throw new AppleExportParseError('oversized')
    const record = result.record
    preview.records.push(record); preview.stats.matched++; sources.add(record.sourceName)
    if (!preview.range) preview.range = { startAt: record.startAt, endAt: record.endAt }
    else { if (record.startAt < preview.range.startAt) preview.range.startAt = record.startAt; if (record.endAt > preview.range.endAt) preview.range.endAt = record.endAt }
  })
  parser.on('closetag', () => { depth--; if (!depth) rootClosed = true })
  const guard = tokenGuard()
  const preamble = nativePreamble(text => { guard(text); parser.write(text) })
  const decoder = new TextDecoder('utf-8', { fatal: true })
  return {
    push(bytes: Uint8Array, final: boolean) {
      assertNotCancelled(signal); bytesRead += bytes.length
      if (bytesRead > limits.uncompressedBytes) throw new AppleExportParseError('oversized')
      try {
        preamble(decoder.decode(bytes, { stream: !final }), final)
        if (final) { parser.close(); if (!rootSeen || !rootClosed || depth) throw malformed() }
      } catch (error) { if (error instanceof AppleExportParseError) throw error; throw malformed() }
    },
    result() { if (!rootClosed) throw malformed(); preview.sources = [...sources].sort(); return preview },
  }
}
