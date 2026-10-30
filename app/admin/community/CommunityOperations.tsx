'use client'

import { useState } from 'react'
import styles from './community-operations.module.css'

type ReportStatus = 'open' | 'dismissed' | 'removed'
type Report = {
  postId: string; reporterId: string; reason: string; createdAt: string; status: ReportStatus
  reviewedAt: string | null; reviewNote: string
  post: { authorId: string; authorName: string; body: string; status: string; hasMedia: boolean } | null
}
type ReportPage = { reports: Report[]; nextCursor: string | null }
type CleanupResult = {
  operation: 'account' | 'abandoned'; action: 'preview' | 'clean' | 'finalize'
  rows: { id: string; authorId: string; status: string; hasMedia: boolean; createdAt: string }[]
  nextCursor: string | null; hold?: { startedAt: string; requestReference: string } | null
  waitUntil?: string; processed?: number; completed?: boolean; message?: string
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function requestJson<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      cache: 'no-store', credentials: 'same-origin',
      ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    })
  } catch { throw new Error('The request could not be completed. Refresh the preview before retrying.') }
  let result
  try { result = await response.json() } catch { throw new Error('The response could not be read. Refresh the preview before retrying.') }
  if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : 'The operation could not be completed.')
  return result as T
}

function ReportReview({ report, busy, onReview }: {
  report: Report; busy: boolean
  onReview: (report: Report, action: 'dismiss' | 'remove', note: string, confirmation: string) => Promise<void>
}) {
  const [note, setNote] = useState('')
  const [confirmation, setConfirmation] = useState('')
  return (
    <article className={styles.report}>
      <h3>{report.reason} · {report.status}</h3>
      <p>Reported {new Date(report.createdAt).toLocaleString()}</p>
      {report.post ? (
        <>
          <p>{report.post.authorName} · {report.post.status}{report.post.hasMedia ? ' · attachment' : ''}</p>
          <blockquote className={styles.postBody}>{report.post.body || 'Post content has been cleared.'}</blockquote>
        </>
      ) : <p>The post is no longer available.</p>}
      {report.status === 'open' ? (
        <fieldset disabled={busy} className={styles.fields}>
          <label>Review note (up to 500 characters)
            <textarea value={note} maxLength={500} onChange={event => setNote(event.target.value)} rows={2} />
          </label>
          <button type="button" onClick={() => void onReview(report, 'dismiss', note, '')}>Dismiss report</button>
          {report.post ? (
            <>
              <label>To clear this post and remove its attachment, type <code>REMOVE {report.postId}</code>
                <input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} />
              </label>
              <button type="button" disabled={confirmation !== `REMOVE ${report.postId}`} onClick={() => void onReview(report, 'remove', note, confirmation)}>
                Remove reported post
              </button>
            </>
          ) : null}
        </fieldset>
      ) : <p>Reviewed {report.reviewedAt ? new Date(report.reviewedAt).toLocaleString() : ''}{report.reviewNote ? ` · ${report.reviewNote}` : ''}</p>}
    </article>
  )
}

function ReportQueue() {
  const [status, setStatus] = useState<ReportStatus>('open')
  const [page, setPage] = useState<ReportPage | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function load(cursor?: string) {
    setBusy(true); setMessage('')
    try {
      const params = new URLSearchParams({ status, ...(cursor ? { cursor } : {}) })
      setPage(await requestJson<ReportPage>(`/api/admin/community/reports?${params}`))
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Reports could not be loaded.') }
    finally { setBusy(false) }
  }

  async function review(report: Report, action: 'dismiss' | 'remove', note: string, confirmation: string) {
    setBusy(true); setMessage('')
    try {
      const result = await requestJson<{ success: boolean; cleanupPending?: boolean }>('/api/admin/community/reports', {
        postId: report.postId, reporterId: report.reporterId, action, note, confirmation,
      })
      setPage(null)
      setMessage(result.cleanupPending ? 'The post is hidden. Attachment cleanup is pending; reload open reports to retry.' : 'Review saved. Load the queue to continue.')
    } catch (error) {
      setPage(null)
      setMessage(error instanceof Error ? `${error.message} Load the queue again before retrying.` : 'The review could not be saved. Load the queue again before retrying.')
    }
    finally { setBusy(false) }
  }

  return (
    <section className={styles.panel} aria-labelledby="reports-heading" aria-busy={busy}>
      <h2 id="reports-heading">Reported posts</h2>
      <div className={styles.controls}>
        <label>Report status
          <select disabled={busy} value={status} onChange={event => { setStatus(event.target.value as ReportStatus); setPage(null); setMessage('') }}>
            <option value="open">Open</option><option value="dismissed">Dismissed</option><option value="removed">Removed</option>
          </select>
        </label>
        <button type="button" disabled={busy} onClick={() => void load()}>Load reports</button>
      </div>
      {message ? <p role="status">{message}</p> : null}
      {page?.reports.length === 0 ? <p>No reports in this queue.</p> : null}
      {page?.reports.map(report => <ReportReview key={`${report.postId}:${report.reporterId}`} report={report} busy={busy} onReview={review} />)}
      {page?.nextCursor ? <button type="button" disabled={busy} onClick={() => void load(page.nextCursor!)}>Next reports</button> : null}
    </section>
  )
}

function CleanupPanel({ operation }: { operation: 'account' | 'abandoned' }) {
  const account = operation === 'account'
  const [authorId, setAuthorId] = useState('')
  const [requestReference, setRequestReference] = useState('')
  const [verifiedRequest, setVerifiedRequest] = useState(false)
  const [storageDrainVerified, setStorageDrainVerified] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [preview, setPreview] = useState<CleanupResult | null>(null)
  const [result, setResult] = useState<CleanupResult | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [reviewed, setReviewed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const cleanConfirmation = account ? `CLEAN COMMUNITY ${authorId}` : 'CLEAN ABANDONED COMMUNITY'
  const finalizeConfirmation = `FINALIZE COMMUNITY ${authorId}`
  const referenceValid = requestReference.trim().length >= 3 && requestReference.trim().length <= 200
  const canExecute = Boolean(preview && reviewed && (!account || verifiedRequest && referenceValid))

  function resetPreview() {
    setPreview(null); setResult(null); setCursor(null); setReviewed(false); setStorageDrainVerified(false); setConfirmation(''); setMessage('')
  }

  async function run(action: 'preview' | 'clean' | 'finalize', nextCursor: string | null = null) {
    if (action !== 'preview' && !canExecute) return
    if (action === 'finalize' && !storageDrainVerified) return
    setBusy(true); setMessage('')
    try {
      const data = await requestJson<CleanupResult>('/api/admin/community/cleanup', {
        operation, action, ...(account ? { authorId } : {}),
        ...(action === 'preview' ? nextCursor ? { cursor: nextCursor } : {} : cursor ? { cursor } : {}),
        ...(action !== 'preview' ? { confirmation, ...(account ? { verifiedRequest, requestReference: requestReference.trim(), ...(action === 'finalize' ? { storageDrainVerified } : {}) } : {}) } : {}),
      })
      setReviewed(false); setStorageDrainVerified(false); setConfirmation('')
      if (action === 'preview') { setCursor(nextCursor); setPreview(data); setResult(null) }
      else { setPreview(null); setCursor(null); setResult(data) }
      setMessage(data.message || (action === 'preview' ? 'Preview loaded. Review this batch before confirming.' : 'Batch completed. Preview again to continue.'))
    } catch (error) {
      setPreview(null); setReviewed(false); setStorageDrainVerified(false); setConfirmation('')
      setMessage(error instanceof Error ? error.message : 'Cleanup could not be completed. Preview again before retrying.')
    } finally { setBusy(false) }
  }

  return (
    <section className={styles.panel} aria-labelledby={`${operation}-heading`} aria-busy={busy}>
      <h2 id={`${operation}-heading`}>{account ? 'Verified deletion request' : 'Abandoned uploads'}</h2>
      <p>{account
        ? 'This removes only Community posts, attachments and reports. Starting cleanup blocks this member from creating Community posts, reports or uploads. It does not delete their login, billing or health records.'
        : 'Preview drafts at least seven days old and deletion records at least 24 hours old. Cleanup removes their attachments and retains private deletion records. Published posts and recent drafts are protected.'}</p>
      <fieldset disabled={busy} className={styles.fields}>
        {account ? (
          <>
            <label>Member auth user ID
              <input value={authorId} onChange={event => { setAuthorId(event.target.value.trim().toLowerCase()); setVerifiedRequest(false); setRequestReference(''); resetPreview() }} autoComplete="off" spellCheck={false} />
            </label>
            <label>Verified support request reference
              <input value={requestReference} minLength={3} maxLength={200} onChange={event => { setRequestReference(event.target.value); resetPreview() }} autoComplete="off" />
            </label>
            <label className={styles.checkbox}>
              <input type="checkbox" checked={verifiedRequest} onChange={event => setVerifiedRequest(event.target.checked)} />
              I verified this member&apos;s deletion request and identity through the existing support process.
            </label>
          </>
        ) : null}
        <div className={styles.controls}>
          <button type="button" disabled={account && !uuid.test(authorId)} onClick={() => void run('preview')}>Preview first batch</button>
          {result?.nextCursor ? <button type="button" onClick={() => void run('preview', result.nextCursor)}>Preview next batch</button> : null}
          {preview?.nextCursor ? <button type="button" onClick={() => void run('preview', preview.nextCursor)}>Preview next batch without changes</button> : null}
        </div>
        {preview ? (
          <>
            <p>{preview.rows.length} records in this preview{preview.nextCursor ? '; more records follow.' : '.'}</p>
            {preview.hold ? <p>Community writes blocked since {new Date(preview.hold.startedAt).toLocaleString()}. Request: {preview.hold.requestReference}</p> : null}
            {preview.waitUntil ? <p>Final row removal can be checked after {new Date(preview.waitUntil).toLocaleString()}. A fresh media absence check is still required.</p> : null}
            {preview.rows.length ? (
              <ul className={styles.rows}>
                {preview.rows.map(row => <li key={row.id}><code>{row.id}</code> · {row.status}{row.hasMedia ? ' · attachment' : ''}<br />Owner: <code>{row.authorId}</code></li>)}
              </ul>
            ) : null}
            <label className={styles.checkbox}>
              <input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />
              I reviewed this batch and its owner scope.
            </label>
            {account && preview.hold ? (
              <label className={styles.checkbox}>
                <input type="checkbox" checked={storageDrainVerified} onChange={event => setStorageDrainVerified(event.target.checked)} />
                For final row removal, I confirmed upload requests started before the hold can no longer complete under the target Storage service&apos;s documented request limit. Waiting 24 hours alone does not verify this.
              </label>
            ) : null}
            <label>To clean this batch, type <code>{cleanConfirmation}</code>
              {account && preview.hold ? <>. To finalize, type <code>{finalizeConfirmation}</code></> : null}
              <input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} />
            </label>
            <div className={styles.controls}>
              <button type="button" disabled={!canExecute || confirmation !== cleanConfirmation} onClick={() => void run('clean')}>Clean this batch</button>
              {account && preview.hold ? (
                <button type="button" disabled={!canExecute || !storageDrainVerified || confirmation !== finalizeConfirmation} onClick={() => void run('finalize')}>Verify media and finalize Community cleanup</button>
              ) : null}
            </div>
          </>
        ) : null}
      </fieldset>
      {message ? <p role="status">{message}</p> : null}
      {result?.processed !== undefined ? <p>{result.processed} records processed.</p> : null}
      {result?.completed ? <p>{account ? 'Community cleanup completed. The Community posting hold remains in place.' : 'This abandoned-upload cleanup pass completed.'}</p> : null}
    </section>
  )
}

export default function CommunityOperations() {
  return <div className={styles.workspace}><ReportQueue /><CleanupPanel operation="account" /><CleanupPanel operation="abandoned" /></div>
}
