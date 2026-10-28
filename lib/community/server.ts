import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasMemberAccess } from '@/lib/commerce/access'
import {
  COMMUNITY_BODY_LIMIT, COMMUNITY_CATEGORIES, COMMUNITY_MEDIA_BUCKET, COMMUNITY_MEDIA_FORMATS,
  COMMUNITY_REPORT_REASONS, communityMediaError, validCommunityId,
  type CommunityMediaMime, type CommunityPost, type CommunityPostInput, type CommunityReserveResponse,
} from './contracts'

export type CommunityRow = {
  id: string; author_id: string; author_name: string; category: CommunityPost['category']; body: string
  status: 'draft' | 'published' | 'deleting'; media_path: string | null; media_type: 'image' | 'video' | null
  media_mime: CommunityMediaMime | null; media_size: number | null; created_at: string; published_at: string | null
}
type Identity = { supabase: SupabaseClient; user: { id: string }; client: Record<string, unknown> }

export class CommunityError extends Error {
  constructor(message: string, public status = 503, public code = 'COMMUNITY_UNAVAILABLE') { super(message) }
}
const unavailable = () => new CommunityError('Community is temporarily unavailable. Please try again.')
const conflict = () => new CommunityError('This post changed. Refresh the community before trying again.', 409, 'POST_CHANGED')

export async function communityResponse(action: () => Promise<Response>) {
  try { return await action() } catch (error) {
    const safe = error instanceof CommunityError ? error : unavailable()
    return Response.json({ error: safe.message, code: safe.code }, { status: safe.status, headers: { 'Cache-Control': 'private, no-store' } })
  }
}

export function assertCommunityOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) throw new CommunityError('This request could not be verified.', 403, 'INVALID_ORIGIN')
  if (!request.headers.get('content-type')?.startsWith('application/json') && request.method !== 'DELETE') throw new CommunityError('Send a JSON request.', 415, 'INVALID_CONTENT_TYPE')
}

export async function readCommunityJson(request: Request): Promise<Record<string, unknown>> {
  // Post text and one media descriptor are small; reject oversized bodies before parsing.
  if (Number(request.headers.get('content-length') || 0) > 20_000) throw new CommunityError('This post is too large.', 413, 'POST_TOO_LARGE')
  const text = await request.text()
  if (text.length > 20_000) throw new CommunityError('This post is too large.', 413, 'POST_TOO_LARGE')
  try {
    const value: unknown = JSON.parse(text)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
    return value as Record<string, unknown>
  } catch { throw new CommunityError('This post could not be read.', 400, 'INVALID_POST') }
}

export async function communityIdentity(allowInactive = false): Promise<Identity> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) throw new CommunityError('Sign in to use the community.', 401, 'UNAUTHORIZED')
  const { data: client, error } = await supabase.from('clients').select('client_id,auth_user_id,full_name,program,access,active,verified_purchase,subscription_ends_at').eq('auth_user_id', user.id).maybeSingle()
  if (error) throw unavailable()
  if (!client || (!allowInactive && !hasMemberAccess(client))) throw new CommunityError('An active membership is required for the community.', 403, 'MEMBERSHIP_REQUIRED')
  return { supabase, user, client }
}

function requireId(value: unknown): asserts value is string {
  if (!validCommunityId(value)) throw new CommunityError('A valid post identifier is required.', 400, 'INVALID_POST_ID')
}

export function communityPost(row: CommunityRow): CommunityPost {
  return {
    id: row.id, authorId: row.author_id, authorName: row.author_name, category: row.category,
    body: row.body, publishedAt: row.published_at!,
    media: row.media_path && row.media_type && row.media_mime ? { type: row.media_type, mimeType: row.media_mime, url: `/api/community/posts/${row.id}/media` } : null,
  }
}

function parseInput(value: Record<string, unknown>): CommunityPostInput {
  requireId(value.id)
  if (typeof value.body !== 'string' || value.body.trim().length > COMMUNITY_BODY_LIMIT || !COMMUNITY_CATEGORIES.includes(value.category as CommunityPost['category'])) throw new CommunityError('Choose a topic and use 3,000 characters or fewer.', 400, 'INVALID_POST')
  let media: CommunityPostInput['media'] = null
  if (value.media !== null && value.media !== undefined) {
    if (typeof value.media !== 'object' || Array.isArray(value.media)) throw new CommunityError('Choose one photo or video.', 400, 'INVALID_MEDIA')
    const descriptor = value.media as Record<string, unknown>
    const mediaError = communityMediaError(descriptor.mimeType, descriptor.size)
    if (mediaError) throw new CommunityError(mediaError, 400, 'INVALID_MEDIA')
    media = { mimeType: descriptor.mimeType as CommunityMediaMime, size: descriptor.size as number }
  }
  if (!value.body.trim() && !media) throw new CommunityError('Write a post or choose one photo or video.', 400, 'EMPTY_POST')
  return { id: value.id.toLowerCase(), body: value.body.trim(), category: value.category as CommunityPost['category'], media }
}

async function ownedRow(identity: Identity, id: string) {
  requireId(id)
  const { data, error } = await identity.supabase.from('community_posts').select('*').eq('id', id).eq('author_id', identity.user.id).maybeSingle()
  if (error) throw unavailable()
  if (!data) throw new CommunityError('This post is not available.', 404, 'POST_NOT_FOUND')
  return data as CommunityRow
}

function reserveResult(row: CommunityRow): CommunityReserveResponse {
  if (row.status === 'published') return { post: communityPost(row) }
  if (row.status !== 'draft' || !row.media_path || !row.media_mime || !row.media_size) throw conflict()
  return { draft: { id: row.id, mediaPath: row.media_path, mediaMime: row.media_mime, mediaSize: row.media_size } }
}

export async function reserveCommunityPost(identity: Identity, value: Record<string, unknown>): Promise<CommunityReserveResponse> {
  const input = parseInput(value)
  const format = input.media ? COMMUNITY_MEDIA_FORMATS[input.media.mimeType] : null
  const mediaPath = format ? `${identity.user.id}/${input.id}/attachment.${format.extension}` : null
  const matches = (row: CommunityRow) => row.author_id === identity.user.id && row.category === input.category && row.body === input.body && row.media_path === mediaPath && row.media_mime === (input.media?.mimeType || null) && Number(row.media_size || 0) === (input.media?.size || 0)
  const { data: existing, error: readError } = await identity.supabase.from('community_posts').select('*').eq('id', input.id).maybeSingle()
  if (readError) throw unavailable()
  if (existing) {
    if (!matches(existing)) throw conflict()
    return reserveResult(existing)
  }
  // Only this verified server path may publish or reserve posts. Browser table writes are denied.
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const authorName = typeof identity.client.full_name === 'string' ? identity.client.full_name.trim().slice(0, 80) : ''
  const { data, error } = await admin.from('community_posts').insert({
    id: input.id, author_id: identity.user.id, author_name: authorName || 'Community member', category: input.category, body: input.body,
    status: input.media ? 'draft' : 'published', media_path: mediaPath, media_type: format?.kind || null,
    media_mime: input.media?.mimeType || null, media_size: input.media?.size || null, published_at: input.media ? null : now,
  }).select('*').single()
  if (error?.code === '23505') {
    const recovered = await ownedRow(identity, input.id)
    if (!matches(recovered)) throw conflict()
    return reserveResult(recovered)
  }
  if (error || !data) throw unavailable()
  return reserveResult(data)
}

export async function listCommunityPosts(identity: Identity, cursor: string | null) {
  let query = identity.supabase.from('community_posts').select('*').eq('status', 'published').order('published_at', { ascending: false }).order('id', { ascending: false }).limit(21)
  if (cursor) {
    let value: { at?: unknown; id?: unknown }
    try { value = JSON.parse(atob(cursor)) } catch { throw new CommunityError('This feed page could not be read. Refresh the community.', 400, 'INVALID_CURSOR') }
    if (typeof value.at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value.at) || !Number.isFinite(Date.parse(value.at)) || !validCommunityId(value.id)) throw new CommunityError('This feed page could not be read. Refresh the community.', 400, 'INVALID_CURSOR')
    query = query.or(`published_at.lt.${value.at},and(published_at.eq.${value.at},id.lt.${value.id})`)
  }
  const { data, error } = await query
  if (error) throw unavailable()
  const rows = (data || []) as CommunityRow[]
  const visible = rows.slice(0, 20)
  const last = visible[visible.length - 1]
  return { posts: visible.map(communityPost), viewerId: identity.user.id, nextCursor: rows.length > 20 && last ? btoa(JSON.stringify({ at: last.published_at, id: last.id })) : null }
}

export function validCommunityMediaBytes(bytes: Uint8Array, mime: CommunityMediaMime): boolean {
  const starts = (...prefix: number[]) => prefix.every((value, index) => bytes[index] === value)
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end))
  if (mime === 'image/jpeg') return bytes.length >= 4 && starts(0xff, 0xd8, 0xff)
  if (mime === 'image/png') return bytes.length >= 24 && starts(137, 80, 78, 71, 13, 10, 26, 10) && ascii(12, 16) === 'IHDR'
  if (mime === 'image/webp') return bytes.length >= 16 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'
  if (mime === 'video/webm') return bytes.length >= 16 && starts(0x1a, 0x45, 0xdf, 0xa3) && ascii(4, Math.min(bytes.length, 4096)).includes('webm')
  if (bytes.length < 16 || ascii(4, 8) !== 'ftyp') return false
  const brand = ascii(8, 12)
  if (mime === 'video/quicktime') return brand === 'qt  '
  // HEIC/HEIF and AVIF also use ftyp containers: never accept them as video.
  return ['isom', 'iso2', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V ', 'MSNV', 'dash'].includes(brand)
}

export async function publishCommunityPost(identity: Identity, id: string) {
  const row = await ownedRow(identity, id)
  if (row.status === 'published') return { post: communityPost(row) }
  if (row.status !== 'draft' || !row.media_path || !row.media_mime || !row.media_size) throw conflict()
  // Download through the member's RLS context; no object becomes public or signed for other audiences.
  const { data: blob, error: downloadError } = await identity.supabase.storage.from(COMMUNITY_MEDIA_BUCKET).download(row.media_path)
  if (downloadError || !blob) throw new CommunityError('The upload is not ready. Retry the upload, then post again.', 409, 'MEDIA_MISSING')
  if (blob.size !== Number(row.media_size) || communityMediaError(row.media_mime, blob.size) || !validCommunityMediaBytes(new Uint8Array(await blob.arrayBuffer()), row.media_mime)) throw new CommunityError('This file does not match its supported photo or video format. Remove it and choose another file.', 422, 'MEDIA_INVALID')
  const admin = createAdminClient()
  const { data, error } = await admin.from('community_posts').update({ status: 'published', published_at: new Date().toISOString() }).eq('id', id).eq('author_id', identity.user.id).eq('status', 'draft').select('*').maybeSingle()
  if (error) throw unavailable()
  if (data) return { post: communityPost(data) }
  const recovered = await ownedRow(identity, id)
  if (recovered.status === 'published') return { post: communityPost(recovered) }
  throw conflict()
}

export async function deleteCommunityPost(identity: Identity, id: string) {
  requireId(id)
  // An expired author cannot SELECT published community rows through member RLS.
  // This cleanup-only lookup is explicitly scoped to the verified author's ID.
  const admin = createAdminClient()
  let { data: row, error: lookupError } = await admin.from('community_posts').select('*').eq('id', id).eq('author_id', identity.user.id).maybeSingle()
  if (lookupError) throw unavailable()
  if (!row) {
    // A failed reserve may still be in flight. Reserving this canceled ID as a
    // private tombstone prevents that request from later creating a live draft.
    const inserted = await admin.from('community_posts').insert({
      id, author_id: identity.user.id, author_name: 'Community member', category: 'Progress', body: '',
      status: 'deleting', media_path: null, media_type: null, media_mime: null, media_size: null, published_at: null,
    }).select('*').single()
    if (inserted.error?.code === '23505') {
      const recovered = await admin.from('community_posts').select('*').eq('id', id).eq('author_id', identity.user.id).maybeSingle()
      if (recovered.error) throw unavailable()
      row = recovered.data
      if (!row) throw new CommunityError('This post is not available.', 404, 'POST_NOT_FOUND')
    } else {
      if (inserted.error || !inserted.data) throw unavailable()
      row = inserted.data
    }
  }
  // Scrub content before touching Storage, including retries of an older
  // tombstone. Keep only the private identity/path needed to reconcile a late
  // upload or a failed physical removal; never retain the deleted post text.
  const { data, error } = await admin.from('community_posts').update({
    status: 'deleting', body: '', author_name: 'Community member', category: 'Progress', published_at: null,
  }).eq('id', id).eq('author_id', identity.user.id).select('id').maybeSingle()
  if (error || !data) throw unavailable()
  if (row.media_path) {
    const { error } = await admin.storage.from(COMMUNITY_MEDIA_BUCKET).remove([row.media_path])
    if (error) throw new CommunityError('The post is hidden, but its attachment could not be removed. Retry deletion to finish cleanup.', 503, 'CLEANUP_PENDING')
  }
  // Retain a tombstone to reject a late upload or retry of a canceled submission ID.
  return { success: true }
}

export async function reportCommunityPost(identity: Identity, id: string, value: Record<string, unknown>) {
  requireId(id)
  if (!COMMUNITY_REPORT_REASONS.includes(value.reason as typeof COMMUNITY_REPORT_REASONS[number])) throw new CommunityError('Choose a reason for reporting this post.', 400, 'INVALID_REPORT')
  const { data, error } = await identity.supabase.from('community_posts').select('id,author_id').eq('id', id).eq('status', 'published').maybeSingle()
  if (error) throw unavailable()
  if (!data) throw new CommunityError('This post is not available.', 404, 'POST_NOT_FOUND')
  const admin = createAdminClient()
  const { error: reportError } = await admin.from('community_reports').upsert({ post_id: id, reporter_id: identity.user.id, reason: value.reason }, { onConflict: 'post_id,reporter_id', ignoreDuplicates: true })
  if (reportError) throw unavailable()
  return { success: true }
}

export async function communityMediaResponse(identity: Identity, id: string, request: Request) {
  requireId(id)
  const { data: row, error } = await identity.supabase.from('community_posts').select('*').eq('id', id).eq('status', 'published').maybeSingle()
  if (error) throw unavailable()
  if (!row?.media_path || !row.media_mime) throw new CommunityError('This attachment is not available.', 404, 'MEDIA_NOT_FOUND')
  const headers = new Headers({ 'Content-Type': row.media_mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes', 'Content-Disposition': 'inline' })
  const range = request.headers.get('range')
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range)
    if (!match || (!match[1] && !match[2]) || [match?.[1], match?.[2]].some(value => value && !Number.isSafeInteger(Number(value)))) return new Response(null, { status: 416, headers: { ...Object.fromEntries(headers), 'Content-Range': `bytes */${row.media_size}` } })
  }
  // getUser and membership were verified above; getSession supplies only the
  // matching bearer token for the private Storage request, never authorization.
  const { data: { session }, error: sessionError } = await identity.supabase.auth.getSession()
  if (sessionError || !session?.access_token) throw new CommunityError('Sign in again to load this attachment.', 401, 'UNAUTHORIZED')
  const storageBase = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!storageBase || !publishableKey) throw unavailable()
  const objectPath = row.media_path.split('/').map(encodeURIComponent).join('/')
  const upstream = await fetch(new URL(`/storage/v1/object/authenticated/${COMMUNITY_MEDIA_BUCKET}/${objectPath}`, storageBase), {
    headers: { Authorization: `Bearer ${session.access_token}`, apikey: publishableKey, 'Accept-Encoding': 'identity', ...(range ? { Range: range } : {}) },
    cache: 'no-store', redirect: 'error', signal: request.signal,
  })
  if (upstream.status === 416) return new Response(null, { status: 416, headers: { ...Object.fromEntries(headers), 'Content-Range': `bytes */${row.media_size}` } })
  if (upstream.status !== 200 && upstream.status !== 206) throw new CommunityError('The attachment could not be loaded. Please try again.', upstream.status === 404 ? 404 : 503, 'MEDIA_UNAVAILABLE')
  for (const name of ['Content-Length', 'Content-Range']) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  // Preserve origin Range responses and stream bytes without buffering an entire video per seek.
  return new Response(upstream.body, { status: upstream.status, headers })
}
