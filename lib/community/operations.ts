import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAOSAdminUser } from '@/lib/aos/getAOSAdminUser'
import { createAdminClient } from '@/lib/supabase/admin'
import { COMMUNITY_MEDIA_BUCKET, COMMUNITY_MEDIA_FORMATS, validCommunityId } from './contracts'
import { CommunityError, assertCommunityOrigin, communityResponse, readCommunityJson, type CommunityRow } from './server'

const BATCH = 25
const DAY = 86_400_000
const unavailable = () => new CommunityError('Community operations are unavailable. Confirm the reviewed Community setup has been applied.', 503, 'OPERATIONS_UNAVAILABLE')
const invalid = (message: string) => new CommunityError(message, 400, 'INVALID_OPERATION')
type Operator = { db: SupabaseClient; id: string }
type CleanupRow = CommunityRow & { cleanup_marked_at: string | null; media_cleaned_at: string | null; upload_active_until: string | null }
type Hold = { author_id: string; started_at: string; request_reference: string }

function requireId(value: unknown): string {
  if (!validCommunityId(value)) throw invalid('A valid Community owner or post identifier is required.')
  return value.toLowerCase()
}
function confirm(value: unknown, expected: string) {
  if (value !== expected) throw invalid(`Type ${expected} to confirm this operation.`)
}
function check(error: unknown) { if (error) throw unavailable() }

// Reuse the application's existing operator decision. A member session never
// creates a privileged client, and neither request bodies nor user_metadata
// can select an operator role.
export async function communityOperator(): Promise<Operator> {
  const user = await getAOSAdminUser()
  if (!user) throw new CommunityError('Existing administrator access is required.', 403, 'OPERATOR_REQUIRED')
  return { db: createAdminClient(), id: user.id }
}

export async function communityOperatorResponse(request: Request, mutation: boolean, run: (operator: Operator) => Promise<unknown>) {
  return communityResponse(async () => {
    if (mutation) assertCommunityOrigin(request)
    const result = await run(await communityOperator())
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  })
}
export { readCommunityJson }

function rowSummary(row: CleanupRow) {
  return { id: row.id, authorId: row.author_id, status: row.status, hasMedia: !!row.media_path, createdAt: row.created_at }
}

function exactMediaPath(row: CleanupRow) {
  if (!row.media_path) return null
  const format = row.media_mime && COMMUNITY_MEDIA_FORMATS[row.media_mime]
  const expected = format && `${row.author_id}/${row.id}/attachment.${format.extension}`
  if (!expected || row.media_path !== expected) throw new CommunityError('An attachment path needs manual review. No file was removed.', 409, 'MEDIA_PATH_REVIEW')
  return expected
}

async function removeReservedMedia(db: SupabaseClient, row: CleanupRow) {
  const path = exactMediaPath(row)
  if (path) {
    const bucket = db.storage.from(COMMUNITY_MEDIA_BUCKET)
    const removed = await bucket.remove([path])
    if (removed.error) throw new CommunityError('The post is hidden. Attachment cleanup is pending; retry this batch.', 503, 'CLEANUP_PENDING')
    const split = path.lastIndexOf('/')
    const objects = await bucket.list(path.slice(0, split), { search: path.slice(split + 1), limit: 2 })
    if (objects.error || !objects.data || objects.data.some(object => object.name === path.slice(split + 1))) throw new CommunityError('Attachment removal could not be verified. Retry reconciliation.', 503, 'CLEANUP_PENDING')
  }
  const marked = await db.from('community_posts').update({ media_cleaned_at: new Date().toISOString() })
    .eq('id', row.id).eq('author_id', row.author_id).eq('status', 'deleting').select('id').maybeSingle()
  check(marked.error)
  if (!marked.data) throw new CommunityError('The post changed during cleanup. Preview again.', 409, 'POST_CHANGED')
}

async function scrubAndClean(db: SupabaseClient, row: CleanupRow, abandonedCutoff?: string) {
  // Never use a path supplied by the caller, and hide/scrub before Storage.
  exactMediaPath(row)
  let query = db.from('community_posts').update({ status: 'deleting', body: '', author_name: 'Community member', category: 'Progress', published_at: null, media_cleaned_at: null })
    .eq('id', row.id).eq('author_id', row.author_id).eq('status', row.status)
  if (abandonedCutoff && row.status === 'draft') query = query.lte('created_at', abandonedCutoff)
    .or(`upload_active_until.is.null,upload_active_until.lte.${new Date(Date.now() - 15 * 60_000).toISOString()}`)
  const updated = await query.select('id').maybeSingle()
  check(updated.error)
  if (!updated.data) throw new CommunityError('The post changed during cleanup. Preview again.', 409, 'POST_CHANGED')
  await removeReservedMedia(db, row)
}

async function getHold(db: SupabaseClient, authorId: string): Promise<Hold | null> {
  const result = await db.from('community_cleanup_holds').select('author_id,started_at,request_reference').eq('author_id', authorId).maybeSingle()
  check(result.error)
  return result.data as Hold | null
}
function holdSummary(hold: Hold | null) {
  return hold ? { startedAt: hold.started_at, requestReference: hold.request_reference } : null
}

export async function cleanupCommunity(operator: Operator, value: Record<string, unknown>) {
  const { db } = operator
  const operation = value.operation
  const action = value.action ?? 'preview'
  if (!['account', 'abandoned'].includes(String(operation)) || !['preview', 'clean', 'finalize'].includes(String(action))) throw invalid('Choose a Community cleanup operation and action.')
  if (operation === 'abandoned' && action === 'finalize') throw invalid('Abandoned cleanup retains private tombstones.')
  const authorId = operation === 'account' ? requireId(value.authorId) : null
  const cursor = value.cursor == null ? null : requireId(value.cursor)
  let hold = authorId ? await getHold(db, authorId) : null
  const cutoff = new Date(Date.now() - 7 * DAY).toISOString()
  const deletingCutoff = new Date(Date.now() - DAY).toISOString()

  if (action === 'clean') {
    if (authorId) {
      confirm(value.confirmation, `CLEAN COMMUNITY ${authorId}`)
      if (value.verifiedRequest !== true || typeof value.requestReference !== 'string' || value.requestReference.trim().length < 3 || value.requestReference.trim().length > 200) throw invalid('Verify the deletion request and enter its reference before starting Community cleanup.')
      // The review SQL serializes this hold with post writes and denies all
      // further direct uploads. Retain the hold across retries and completion.
      const inserted = await db.from('community_cleanup_holds').upsert({ author_id: authorId, requested_by: operator.id, request_reference: value.requestReference.trim() }, { onConflict: 'author_id', ignoreDuplicates: true })
      check(inserted.error)
      hold = await getHold(db, authorId)
      if (!hold) throw unavailable()
    } else confirm(value.confirmation, 'CLEAN ABANDONED COMMUNITY')
  }

  if (action === 'finalize') {
    confirm(value.confirmation, `FINALIZE COMMUNITY ${authorId}`)
    if (!hold || !Number.isFinite(Date.parse(hold.started_at)) || Date.parse(hold.started_at) > Date.now() - DAY) throw new CommunityError('Keep the Community hold in place for at least 24 hours, then reconcile uploads before removing rows.', 409, 'DRAIN_PENDING')
    if (value.storageDrainVerified !== true) throw new CommunityError('Verify that pre-hold upload requests can no longer complete under the target Storage request limits before finalizing.', 409, 'DRAIN_VERIFICATION_REQUIRED')
    const unfinished = await db.from('community_posts').select('id').eq('author_id', authorId)
      .or('status.neq.deleting,media_cleaned_at.is.null').limit(1)
    check(unfinished.error)
    if (!unfinished.data || unfinished.data.length) throw new CommunityError('Clean all Community posts and attachments for this owner before finalizing.', 409, 'CLEANUP_PENDING')
    // List the exact owner prefix, including unexpected or late objects. Never
    // infer physical absence from SQL Storage metadata or a prior remove call.
    const objects = await db.storage.from(COMMUNITY_MEDIA_BUCKET).list(authorId!, { limit: 1 })
    if (objects.error || !objects.data || objects.data.length) throw new CommunityError('Owner media remains or its absence could not be verified. Reconcile uploads before finalizing.', 409, 'CLEANUP_PENDING')
  }

  let query = db.from('community_posts').select('*').order('id', { ascending: true }).limit(BATCH + 1)
  if (authorId) query = query.eq('author_id', authorId)
  else query = query.or(`and(status.eq.draft,created_at.lte.${cutoff},or(upload_active_until.is.null,upload_active_until.lte.${new Date(Date.now() - 15 * 60_000).toISOString()})),and(status.eq.deleting,cleanup_marked_at.lte.${deletingCutoff})`)
  if (cursor) query = query.gt('id', cursor)
  const selected = await query
  check(selected.error)
  const all = (selected.data || []) as CleanupRow[]
  const rows = all.slice(0, BATCH)
  const nextCursor = all.length > BATCH ? rows[rows.length - 1].id : null
  let processed = 0
  const pending: string[] = []
  if (action === 'clean') {
    for (const row of rows) {
      try { await scrubAndClean(db, row, authorId ? undefined : cutoff); processed++ }
      catch (error) {
        if (!(error instanceof CommunityError) || !['CLEANUP_PENDING', 'POST_CHANGED', 'MEDIA_PATH_REVIEW'].includes(error.code)) throw error
        pending.push(row.id)
      }
    }
  }
  let completed = false
  if (action === 'finalize') {
    if (rows.length) {
      const deleted = await db.from('community_posts').delete().eq('author_id', authorId).eq('status', 'deleting').in('id', rows.map(row => row.id)).select('id')
      check(deleted.error)
      if (deleted.data?.length !== rows.length) throw new CommunityError('The cleanup batch changed. Preview again.', 409, 'POST_CHANGED')
      processed = deleted.data.length
    }
    // Also remove this member's own reports, bounded separately. Other
    // reporters' records cascade only with this member's removed posts.
    const reports = await db.from('community_reports').select('post_id').eq('reporter_id', authorId).order('post_id', { ascending: true }).limit(BATCH)
    check(reports.error)
    if (reports.data?.length) {
      const removed = await db.from('community_reports').delete().eq('reporter_id', authorId).in('post_id', reports.data.map(row => row.post_id))
      check(removed.error)
    }
    const remainingPosts = await db.from('community_posts').select('id').eq('author_id', authorId).limit(1)
    const remainingReports = await db.from('community_reports').select('post_id').eq('reporter_id', authorId).limit(1)
    check(remainingPosts.error); check(remainingReports.error)
    completed = !!remainingPosts.data && !!remainingReports.data && !remainingPosts.data.length && !remainingReports.data.length
  }
  return {
    operation, action, rows: rows.map(rowSummary), nextCursor,
    hold: holdSummary(hold), waitUntil: hold ? new Date(Date.parse(hold.started_at) + DAY).toISOString() : null,
    processed, cleanupPending: pending, completed,
    message: pending.length ? 'Some records changed or need attachment reconciliation. Preview from the beginning to review and retry those rows.'
      : completed ? 'Community post rows and this member’s reports are removed. The Community hold remains; Auth, billing and health data were not changed.'
        : action === 'finalize' ? 'This batch is removed. Preview from the beginning and finalize again until complete.'
          : action === 'clean' ? 'This batch is scrubbed and its reserved media removal verified. Retained tombstones still need late-upload reconciliation.'
            : 'Preview only. No data changed.',
  }
}

type ReportRow = { post_id: string; reporter_id: string; reason: string; created_at: string; status: string; reviewed_at: string | null; review_note: string }
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/

export async function listCommunityReports(operator: Operator, url: URL) {
  const status = url.searchParams.get('status') || 'open'
  if (!['open', 'dismissed', 'removed'].includes(status)) throw invalid('Choose a report review status.')
  let query = operator.db.from('community_reports').select('post_id,reporter_id,reason,created_at,status,reviewed_at,review_note')
    .eq('status', status).order('created_at', { ascending: true }).order('post_id', { ascending: true }).order('reporter_id', { ascending: true }).limit(BATCH + 1)
  const cursor = url.searchParams.get('cursor')
  if (cursor) {
    let page: { at?: unknown; postId?: unknown; reporterId?: unknown }
    try { page = JSON.parse(atob(cursor)) } catch { throw invalid('This report page is invalid. Reload the queue.') }
    if (typeof page.at !== 'string' || !timestamp.test(page.at) || !Number.isFinite(Date.parse(page.at))) throw invalid('This report page is invalid. Reload the queue.')
    const postId = requireId(page.postId), reporterId = requireId(page.reporterId)
    query = query.or(`created_at.gt.${page.at},and(created_at.eq.${page.at},post_id.gt.${postId}),and(created_at.eq.${page.at},post_id.eq.${postId},reporter_id.gt.${reporterId})`)
  }
  const result = await query
  check(result.error)
  const all = (result.data || []) as ReportRow[], rows = all.slice(0, BATCH)
  const ids = [...new Set(rows.map(row => row.post_id))]
  const posts = ids.length ? await operator.db.from('community_posts').select('id,author_id,author_name,body,status,media_path').in('id', ids) : { data: [], error: null }
  check(posts.error)
  const last = rows[rows.length - 1]
  return {
    reports: rows.map(row => {
      const post = posts.data?.find(post => post.id === row.post_id)
      return { postId: row.post_id, reporterId: row.reporter_id, reason: row.reason, createdAt: row.created_at, status: row.status, reviewedAt: row.reviewed_at, reviewNote: row.review_note,
        post: post ? { authorId: post.author_id, authorName: post.author_name, body: post.body, status: post.status, hasMedia: !!post.media_path } : null }
    }),
    nextCursor: all.length > BATCH && last ? btoa(JSON.stringify({ at: last.created_at, postId: last.post_id, reporterId: last.reporter_id })) : null,
  }
}

export async function reviewCommunityReport(operator: Operator, value: Record<string, unknown>) {
  const postId = requireId(value.postId), reporterId = requireId(value.reporterId)
  if (!['dismiss', 'remove'].includes(String(value.action))) throw invalid('Choose dismiss or remove for this report.')
  const note = value.note == null ? '' : value.note
  if (typeof note !== 'string' || note.trim().length > 500) throw invalid('Keep the review note to 500 characters or fewer.')
  if (value.action === 'remove') confirm(value.confirmation, `REMOVE ${postId}`)
  const report = await operator.db.from('community_reports').select('status').eq('post_id', postId).eq('reporter_id', reporterId).maybeSingle()
  check(report.error)
  if (!report.data) throw new CommunityError('This report is no longer available.', 404, 'REPORT_NOT_FOUND')
  const status = value.action === 'remove' ? 'removed' : 'dismissed'
  if (report.data.status !== 'open' && report.data.status !== status) throw new CommunityError('This report was already reviewed. Reload the queue.', 409, 'REPORT_CHANGED')
  let cleanupPending = false
  if (value.action === 'remove') {
    const post = await operator.db.from('community_posts').select('*').eq('id', postId).maybeSingle()
    check(post.error)
    if (post.data) {
      try { await scrubAndClean(operator.db, post.data as CleanupRow) }
      catch (error) {
        if (!(error instanceof CommunityError) || error.code !== 'CLEANUP_PENDING') throw error
        cleanupPending = true
      }
    }
  }
  // A partial removal remains in the open queue, allowing the same authorized
  // reviewer to retry without losing the private pointer to pending media.
  if (cleanupPending) return { success: true, cleanupPending: true }
  const updated = await operator.db.from('community_reports').update({ status, reviewed_at: new Date().toISOString(), reviewed_by: operator.id, review_note: note.trim() })
    .eq('post_id', postId).eq('reporter_id', reporterId).eq('status', report.data.status).select('post_id').maybeSingle()
  check(updated.error)
  if (!updated.data) throw new CommunityError('This report was reviewed concurrently. Reload the queue.', 409, 'REPORT_CHANGED')
  return { success: true, cleanupPending }
}
