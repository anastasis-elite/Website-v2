'use client'

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { localDateKey } from '@/lib/timezone'
import { APPLE_EXPORT_LIMITS, validateExportSelection, type ExportPreview, type ExportRecord } from '@/lib/health/appleExport/shared'
import styles from './AppleHealthExportImport.module.css'

type SavedPage = {
  date: string
  timezone: string
  records: Array<ExportRecord & { importedAt: string }>
  total: number
  counts: { heart_rate: number; resting_heart_rate: number }
  range: { startAt: string; endAt: string } | null
  nextCursor: string | null
  receipts: BatchReceipt[]
}
type BatchReceipt = { id: string; date: string; timezone: string; inputCount: number; imported: number; alreadyPresent: number; confirmedAt: string }
type Phase = 'idle' | 'parsing' | 'preview' | 'importing' | 'done'
const provenance = 'Apple Health export; user imported'
const countLabel = (count: number) => `${count} ${count === 1 ? 'reading' : 'readings'}`
const metricLabel = (metric: ExportRecord['metric']) => metric === 'heart_rate' ? 'Heart rate' : 'Resting heart rate'
const safeCount = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const validReceipt = (value: unknown): value is BatchReceipt => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as Record<string, unknown>
  return typeof row.id === 'string' && row.id.length > 0 && row.id.length <= 100 &&
    typeof row.date === 'string' && typeof row.timezone === 'string' && Boolean(validateExportSelection(row.date, row.timezone)) &&
    safeCount(row.inputCount) && row.inputCount > 0 && row.inputCount <= APPLE_EXPORT_LIMITS.batchRecords &&
    safeCount(row.imported) && safeCount(row.alreadyPresent) && row.imported + row.alreadyPresent === row.inputCount &&
    typeof row.confirmedAt === 'string' && Number.isFinite(Date.parse(row.confirmedAt))
}
const timestamp = (value: string, timezone: string) => new Date(value).toLocaleString(undefined, { timeZone: timezone, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' })

export default function AppleHealthExportImport({ clientId, userId, timeZone, eligible }: {
  clientId: string; userId: string; timeZone: string; eligible: boolean
}) {
  const id = useId()
  const initialSelection = (() => { try { return validateExportSelection(localDateKey(new Date(), timeZone), timeZone) } catch { return null } })()
  const [date, setDate] = useState(initialSelection?.date || '')
  const [timezone, setTimezone] = useState(initialSelection?.timezone || '')
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [preview, setPreview] = useState<ExportPreview | null>(null)
  const [previewPage, setPreviewPage] = useState(0)
  const [confirmed, setConfirmed] = useState(false)
  const [progress, setProgress] = useState({ bytes: 0, total: 0 })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [counts, setCounts] = useState({ imported: 0, alreadyPresent: 0, processed: 0 })
  const [replayedBatches, setReplayedBatches] = useState(0)
  const [saved, setSaved] = useState<SavedPage | null>(null)
  const [savedLoading, setSavedLoading] = useState(false)
  const [savedError, setSavedError] = useState('')
  const [savedCursor, setSavedCursor] = useState('0')
  const [reload, setReload] = useState(0)
  const [accountReady, setAccountReady] = useState(false)
  const [accountChanged, setAccountChanged] = useState(false)
  const [accountError, setAccountError] = useState(false)
  const [authRetry, setAuthRetry] = useState(0)
  const worker = useRef<Worker | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const upload = useRef<AbortController | null>(null)
  const savedRequest = useRef<AbortController | null>(null)
  const revision = useRef(0)
  const importLock = useRef(false)
  const selection = validateExportSelection(date, timezone)
  const busy = phase === 'parsing' || phase === 'importing'

  const stopOperations = useCallback(() => {
    revision.current++
    worker.current?.terminate(); worker.current = null
    upload.current?.abort(); upload.current = null
    importLock.current = false
  }, [])

  const clearPreview = useCallback(() => {
    stopOperations()
    setPreview(null); setPreviewPage(0); setConfirmed(false); setPhase('idle')
    setCounts({ imported: 0, alreadyPresent: 0, processed: 0 }); setReplayedBatches(0); setMessage(''); setError('')
  }, [stopOperations])

  const invalidateAccount = useCallback(() => {
    savedRequest.current?.abort()
    if (fileInput.current) fileInput.current.value = ''
    clearPreview(); setFile(null); setSaved(null); setSavedLoading(false)
    setAccountReady(false); setAccountChanged(true)
  }, [clearPreview])

  useEffect(() => {
    let active = true, authRevision = 0, verified = false
    clearPreview(); setSaved(null); setAccountReady(false); setAccountChanged(false); setAccountError(false)
    if (!eligible) return () => { active = false; savedRequest.current?.abort(); stopOperations() }
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      if (session?.user.id !== userId) { authRevision++; verified = false; invalidateAccount() }
      else if (verified) { setAccountReady(true); setAccountError(false) }
    })
    const checkingRevision = authRevision
    void supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!active || authRevision !== checkingRevision) return
      if (authError) { setAccountReady(false); setAccountError(true); return }
      if (data.user?.id !== userId) invalidateAccount()
      else { verified = true; setAccountReady(true) }
    }).catch(() => { if (active && authRevision === checkingRevision) { setAccountReady(false); setAccountError(true) } })
    return () => { active = false; subscription.unsubscribe(); savedRequest.current?.abort(); stopOperations() }
  }, [clientId, userId, eligible, authRetry, clearPreview, stopOperations, invalidateAccount])

  useEffect(() => {
    const selected = validateExportSelection(date, timezone)
    if (!eligible || !accountReady || accountChanged || !selected) { setSaved(null); setSavedLoading(false); return }
    const controller = new AbortController(), expectedDate = selected.date, expectedZone = selected.timezone
    savedRequest.current?.abort(); savedRequest.current = controller
    setSavedLoading(true); setSavedError(''); setSaved(null)
    const query = new URLSearchParams({ date: expectedDate, timezone: expectedZone, cursor: savedCursor })
    void fetch(`/api/health/apple-export?${query}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      headers: { 'X-Expected-Client-Id': clientId, 'X-Expected-User-Id': userId } })
      .then(async response => {
        const payload = await response.json().catch(() => null)
        if (response.status === 409 && payload?.code === 'ACCOUNT_CHANGED') { if (!controller.signal.aborted) invalidateAccount(); return }
        if (!response.ok || payload?.date !== expectedDate || payload?.timezone !== expectedZone || payload.provenance !== provenance ||
          !Array.isArray(payload.records) || payload.records.length > 100 || !safeCount(payload.total) ||
          !safeCount(payload.counts?.heart_rate) || !safeCount(payload.counts?.resting_heart_rate) ||
          !Array.isArray(payload.receipts) || payload.receipts.length > 10 || !payload.receipts.every((receipt: unknown) => validReceipt(receipt) && receipt.date === expectedDate && receipt.timezone === expectedZone) ||
          !(payload.nextCursor === null || typeof payload.nextCursor === 'string' && /^\d+$/.test(payload.nextCursor))) throw new Error('unconfirmed')
        if (!controller.signal.aborted) setSaved(payload)
      })
      .catch(() => { if (!controller.signal.aborted) setSavedError('Your saved imported readings could not be loaded. Retry loading them.') })
      .finally(() => { if (!controller.signal.aborted) setSavedLoading(false) })
    return () => controller.abort()
  }, [clientId, userId, eligible, accountReady, accountChanged, date, timezone, savedCursor, reload, invalidateAccount])

  function changeSelection(nextDate: string, nextZone: string) {
    clearPreview(); setDate(nextDate); setTimezone(nextZone); setSavedCursor('0'); setSaved(null)
  }

  function parse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!eligible || !accountReady || accountChanged || busy) return
    clearPreview()
    if (!selection || !file) { setError('Choose one valid date, timezone and Apple Health XML or ZIP file.'); return }
    if (file.size > APPLE_EXPORT_LIMITS.uncompressedBytes) { setError('This file exceeds the supported import size. No file was uploaded.'); return }
    const currentRevision = revision.current
    setPhase('parsing'); setProgress({ bytes: 0, total: file.size })
    try {
      const parser = new Worker(new URL('../../lib/health/appleExport/parser.worker.ts', import.meta.url), { type: 'module' })
      worker.current = parser
      parser.onmessage = event => {
        if (revision.current !== currentRevision) return
        const result = event.data
        if (result?.type === 'progress' && safeCount(result.bytes) && safeCount(result.total)) setProgress({ bytes: result.bytes, total: result.total })
        if (result?.type === 'preview') {
          parser.terminate(); worker.current = null
          setPreview(result.preview); setPhase('preview'); setConfirmed(false)
          setMessage('Preview ready. Nothing has been sent to your account.')
        }
        if (result?.type === 'error') {
          parser.terminate(); worker.current = null; setPhase('idle')
          setError(typeof result.error === 'string' ? result.error : 'This export could not be read. No file was uploaded.')
        }
      }
      parser.onerror = () => {
        if (revision.current !== currentRevision) return
        parser.terminate(); worker.current = null; setPhase('idle')
        setError('This export could not be read on this device. No file was uploaded. Retry with a supported XML or ZIP file.')
      }
      parser.postMessage({ type: 'start', file, date: selection.date, timezone: selection.timezone })
    } catch { setPhase('idle'); setError('The preview worker could not start. No file was uploaded. Please retry.') }
  }

  function cancel() {
    const importing = phase === 'importing'
    stopOperations(); setPhase(preview ? 'preview' : 'idle'); setConfirmed(false); setError('')
    setMessage(importing ? 'Import stopped. Earlier confirmed batches remain saved; an in-flight batch may also have saved. Refresh saved readings or retry this preview safely.' : 'Preview canceled. No readings were sent to your account.')
    if (importing) setReload(value => value + 1)
  }

  async function save() {
    if (!eligible || !accountReady || accountChanged || !selection || !preview?.records.length || !confirmed || importLock.current) return
    importLock.current = true
    const currentRevision = revision.current, controller = new AbortController(), records = preview.records
    upload.current = controller
    const current = { imported: 0, alreadyPresent: 0, processed: 0 }
    setCounts(current); setReplayedBatches(0); setPhase('importing'); setError(''); setMessage('Importing only the confirmed preview readings…')
    try {
      for (let offset = 0; offset < records.length;) {
        if (controller.signal.aborted || currentRevision !== revision.current) return
        const prefix = `{"date":${JSON.stringify(selection.date)},"timezone":${JSON.stringify(selection.timezone)},"records":[`
        const encoder = new TextEncoder(), batch: string[] = []
        let bytes = encoder.encode(prefix + ']}').length
        while (offset + batch.length < records.length && batch.length < APPLE_EXPORT_LIMITS.batchRecords) {
          const record = JSON.stringify(records[offset + batch.length]), addedBytes = encoder.encode(record).length + (batch.length ? 1 : 0)
          // Leave room for canonical JSONB whitespace within the database batch limit.
          if (bytes + addedBytes > APPLE_EXPORT_LIMITS.bodyBytes - 8 * 1024) break
          batch.push(record); bytes += addedBytes
        }
        if (!batch.length) throw new Error('oversized')
        const response = await fetch('/api/health/apple-export', { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'X-Expected-Client-Id': clientId, 'X-Expected-User-Id': userId },
          body: prefix + batch.join(',') + ']}' })
        const result = await response.json().catch(() => null)
        if (response.status === 409 && result?.code === 'ACCOUNT_CHANGED') { invalidateAccount(); return }
        if (!response.ok || result?.success !== true || result.date !== selection.date || result.timezone !== selection.timezone ||
          !safeCount(result.imported) || !safeCount(result.alreadyPresent) || result.imported + result.alreadyPresent !== batch.length ||
          typeof result.replayed !== 'boolean' || !validReceipt(result.receipt) || result.receipt.date !== selection.date ||
          result.receipt.timezone !== selection.timezone || result.receipt.inputCount !== batch.length) throw new Error('unconfirmed')
        if (controller.signal.aborted || currentRevision !== revision.current) return
        current.imported += result.imported; current.alreadyPresent += result.alreadyPresent; current.processed += batch.length
        offset += batch.length
        setCounts({ ...current })
        if (result.replayed) setReplayedBatches(value => value + 1)
      }
      setPhase('done'); setConfirmed(false); setMessage('All previewed readings are confirmed in your account.'); setReload(value => value + 1)
    } catch {
      if (controller.signal.aborted || currentRevision !== revision.current) return
      setPhase('preview'); setConfirmed(false); setMessage('')
      setError('Import was not fully confirmed. Earlier confirmed batches remain saved, and the last batch may also have saved. Refresh saved readings or confirm and retry the same preview; existing records will not be duplicated.')
      setReload(value => value + 1)
    } finally { if (currentRevision === revision.current) { importLock.current = false; upload.current = null } }
  }

  const previewCounts = preview?.records.reduce((result, record) => ({ ...result, [record.metric]: result[record.metric] + 1 }), { heart_rate: 0, resting_heart_rate: 0 })
  const previewRows = preview?.records.slice(previewPage * 50, (previewPage + 1) * 50) || []
  const renderRows = (records: ExportRecord[]) => <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Recorded reading timestamps, horizontally scrollable"><table><caption>Recorded timestamps and values · {timezone}</caption><thead><tr><th scope="col">Reading</th><th scope="col">Recorded time</th><th scope="col">Value</th><th scope="col">Export source</th></tr></thead><tbody>{records.map((record, index) => <tr key={`${record.metric}:${record.startAt}:${index}`}><td>{metricLabel(record.metric)}</td><td><time dateTime={record.startAt}>{timestamp(record.startAt, timezone)}</time>{record.endAt !== record.startAt ? <> to <time dateTime={record.endAt}>{timestamp(record.endAt, timezone)}</time></> : null}</td><td>{record.value} bpm</td><td>{record.sourceName || 'Not specified'}</td></tr>)}</tbody></table></div>

  return <section className={`${styles.importer} ph-no-capture ph-sensitive`} aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>Import Apple Health export</h3>
    <p>A manual, review-only import for one day. Your XML or ZIP is read on this device. The file, attachments and unrelated health records are not uploaded. Only the readings you preview and confirm are sent to your account.</p>
    <p>{provenance}. This does not connect a device, sync automatically or monitor live heart rate. Imported readings do not change coaching guidance, recovery credit or streaks.</p>
    {!eligible ? <p>Health-record access is not currently available for this membership. Review your <a href="/dashboard/account#billing">membership details</a>.</p> : <>
      {accountChanged ? <div><p role="alert">The signed-in account changed. This preview was cleared. Refresh Account before choosing a new export.</p><button type="button" onClick={() => window.location.reload()}>Refresh Account</button></div> : accountError ? <div><p role="alert">Your signed-in account could not be confirmed. Retry before selecting an export.</p><button type="button" onClick={() => setAuthRetry(value => value + 1)}>Retry account check</button></div> : !accountReady ? <p role="status">Confirming your account before reading an export…</p> : null}
      <form onSubmit={parse} autoComplete="off" aria-busy={phase === 'parsing'}>
        <fieldset disabled={busy || !accountReady || accountChanged}><legend>Choose one day to review</legend>
          <div className={styles.fields}><label htmlFor={`${id}-date`}>Member-local date<input id={`${id}-date`} type="date" required value={date} onChange={event => changeSelection(event.target.value, timezone)} /></label>
          <label htmlFor={`${id}-zone`}>Timezone<input id={`${id}-zone`} type="text" required spellCheck={false} value={timezone} placeholder="America/Chicago" onChange={event => changeSelection(date, event.target.value)} aria-describedby={`${id}-zone-help`} /></label></div>
          <p id={`${id}-zone-help`}>Use the timezone for the day you are reviewing. A day follows its local midnight boundaries, including daylight-saving changes.</p>
          <label htmlFor={`${id}-file`}>Apple Health XML or ZIP export<input ref={fileInput} id={`${id}-file`} type="file" required accept=".xml,.zip,application/xml,text/xml,application/zip" onChange={event => { clearPreview(); setFile(event.target.files?.[0] || null) }} /></label>
          <button type="submit" className="account-outline-button" disabled={!selection || !file}>Preview selected day</button>
        </fieldset>
      </form>
      {busy ? <div className={styles.actions}><p role="status">{phase === 'parsing' ? 'Reading the export on this device…' : `${countLabel(counts.processed)} confirmed from this attempt.`}</p><button type="button" onClick={cancel}>{phase === 'parsing' ? 'Cancel preview' : 'Stop import'}</button></div> : null}
      {phase === 'parsing' && progress.total > 0 ? <progress aria-label="Selected export bytes read on this device" value={Math.min(progress.bytes, progress.total)} max={progress.total} /> : null}
      {message ? <p role="status" aria-live="polite">{message}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {preview && selection ? <section className={styles.preview} aria-labelledby={`${id}-preview`}><h4 id={`${id}-preview`}>Preview · {date} · {timezone}</h4>
        <p>{countLabel(preview.records.length)} selected: {previewCounts?.heart_rate || 0} heart-rate and {previewCounts?.resting_heart_rate || 0} resting-heart-rate readings.</p>
        <p>{preview.stats.recordsSeen} export records examined; {preview.stats.skipped} skipped; {preview.stats.malformed} malformed or invalid records skipped.</p>
        <p>Export sources: {preview.sources.join(', ') || 'Not specified'}.</p>
        {preview.range ? <p>Timestamp range: {timestamp(preview.range.startAt, timezone)} to {timestamp(preview.range.endAt, timezone)}.</p> : <p>No supported readings were found for this day.</p>}
        <p>These are individual recorded samples. Gaps are unknown; the range does not establish continuous coverage. Identical export samples are deduplicated. Native and export readings can overlap without a reliable shared record identity.</p>
        {previewRows.length ? renderRows(previewRows) : null}
        {preview.records.length > 50 ? <div className={styles.actions}><button type="button" disabled={previewPage === 0} onClick={() => setPreviewPage(value => value - 1)}>Previous preview readings</button><span>Page {previewPage + 1} of {Math.ceil(preview.records.length / 50)}</span><button type="button" disabled={(previewPage + 1) * 50 >= preview.records.length} onClick={() => setPreviewPage(value => value + 1)}>Next preview readings</button></div> : null}
        {preview.records.length ? <><label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={busy || phase === 'done' || !accountReady || accountChanged} onChange={event => setConfirmed(event.target.checked)} /><span>I confirm importing these {countLabel(preview.records.length)} for {date} in {timezone} into my account for review only.</span></label><button type="button" className="account-outline-button" disabled={!confirmed || busy || phase === 'done' || !accountReady || accountChanged} onClick={() => { void save() }}>Confirm and import previewed readings</button></> : null}
        {counts.processed ? <p role="status">This attempt: {counts.imported} imported; {counts.alreadyPresent} already present; {counts.processed} confirmed. Counts from an interrupted attempt may exclude an unconfirmed in-flight batch.</p> : null}
        {replayedBatches ? <p>{replayedBatches} previously confirmed {replayedBatches === 1 ? 'batch was' : 'batches were'} recognized. The counts above describe this attempt; original batch confirmations are listed in saved receipts.</p> : null}
      </section> : null}
      <section className={styles.saved} aria-labelledby={`${id}-saved`}><h4 id={`${id}-saved`}>Saved imported readings · {date || 'Choose a date'}</h4>
        <p>{provenance}. Saved samples remain available after reload. They are separate from native device sync and guidance records.</p>
        <button type="button" disabled={!accountReady || accountChanged || !selection || savedLoading} onClick={() => setReload(value => value + 1)}>Refresh saved readings</button>
        {savedLoading ? <p role="status">Loading saved imported readings…</p> : null}{savedError ? <p role="alert">{savedError}</p> : null}
        {saved && selection && saved.date === selection.date && saved.timezone === selection.timezone ? <><p>{countLabel(saved.total)} saved for {date} in {timezone}: {saved.counts.heart_rate} heart-rate and {saved.counts.resting_heart_rate} resting-heart-rate readings.</p>{saved.range ? <p>Timestamp range: {timestamp(saved.range.startAt, timezone)} to {timestamp(saved.range.endAt, timezone)}. Gaps do not establish continuous coverage.</p> : null}{saved.records.length ? renderRows(saved.records) : <p>No imported readings are saved for this day.</p>}<div className={styles.actions}>{savedCursor !== '0' ? <button type="button" onClick={() => setSavedCursor('0')}>First saved readings</button> : null}{saved.nextCursor ? <button type="button" onClick={() => setSavedCursor(saved.nextCursor!)}>Next saved readings</button> : null}</div>
          <h5>Recent confirmed batch receipts</h5><p>Up to 10 original batch confirmations for this selected day and timezone. Each batch is part of an import; these are not whole-file totals. Retrying the same batch preserves its original receipt.</p>
          {saved.receipts.length ? <ul>{saved.receipts.map(receipt => <li key={receipt.id}><time dateTime={receipt.confirmedAt}>{timestamp(receipt.confirmedAt, timezone)}</time> · {receipt.inputCount} readings: {receipt.imported} imported and {receipt.alreadyPresent} already present at the original confirmation.</li>)}</ul> : <p>No confirmed batch receipts for this selected day and timezone.</p>}
        </> : null}
      </section>
    </>}
  </section>
}
