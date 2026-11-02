import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const browser = await importTs('lib/community/browser.ts', {
  '@/lib/supabase/client': 'export function createClient(){throw new Error("Unexpected real auth call")}',
})
const { uploadCommunityMedia, submitCommunityPost, communityFileMime, communityRequest, CommunityRequestError } = browser
const id = '11111111-1111-4111-8111-111111111111'
const draft = { id, mediaPath: `owner/${id}/attachment.jpg`, mediaMime: 'image/jpeg', mediaSize: 120 }
const image = { type: 'image/jpeg', size: 120, name: 'photo.jpg' }
const post = { id, authorId: 'owner', authorName: 'Member', category: 'Progress', body: 'Today’s progress', publishedAt: '2026-10-28T12:00:00Z', media: { type: 'image', mimeType: 'image/jpeg', url: `/api/community/posts/${id}/media` } }
const input = { id, category: 'Progress', body: 'Today’s progress', media: { mimeType: 'image/jpeg', size: 120 } }
const noop = () => {}

test('empty mobile MIME falls back only to known formats and preserves honest HEIC rejection', () => {
  assert.equal(communityFileMime({ type: '', name: 'IMG_1234.MOV' }), 'video/quicktime')
  assert.equal(communityFileMime({ type: '', name: 'IMG_1234.HEIC' }), 'image/heic')
  assert.equal(communityFileMime({ type: '', name: 'unknown.bin' }), '')
  assert.equal(communityFileMime({ type: 'video/mp4', name: 'misleading.jpg' }), 'video/mp4')
})

function uploadHarness(reply = { status: 200 }) {
  const calls = []
  const xhr = {
    upload: {}, headers: {}, status: reply.status, responseText: JSON.stringify(reply.body || {}),
    open(method, url) { this.method = method; this.url = url },
    setRequestHeader(key, value) { this.headers[key] = value },
    send(file) {
      this.file = file
      calls.push(this)
      if (reply.pending) return
      queueMicrotask(() => {
        this.upload.onprogress?.({ lengthComputable: true, loaded: 60, total: 120 })
        if (reply.networkError) this.onerror()
        else if (reply.timeout) this.ontimeout()
        else this.onload()
      })
    },
    abort() { this.aborted = true; this.onabort() },
  }
  return { calls, xhr, options: { file: image, draft, signal: new AbortController().signal, onProgress: noop, getAccessToken: async () => 'member-token', createXHR: () => xhr, storageUrl: 'https://storage.example', publishableKey: 'public-key' } }
}

test('invalid, oversized and mismatched files never start an authenticated upload', async () => {
  for (const file of [ { type: 'image/heic', size: 120 }, { type: 'image/svg+xml', size: 120 }, { type: 'image/jpeg', size: 10 * 1024 * 1024 + 1 }, { type: 'video/mp4', size: 50 * 1024 * 1024 + 1 }, { type: 'image/png', size: 120 }, { type: 'image/jpeg', size: 0 } ]) {
    const harness = uploadHarness()
    let tokenCalls = 0
    await assert.rejects(uploadCommunityMedia({ ...harness.options, file, getAccessToken: async () => { tokenCalls++; return 'token' } }))
    assert.equal(tokenCalls, 0)
    assert.equal(harness.calls.length, 0)
  }
})

test('upload uses only reserved path and member token, never upserts, and reports actual progress', async () => {
  const harness = uploadHarness()
  const progress = []
  await uploadCommunityMedia({ ...harness.options, onProgress: (percent) => progress.push(percent) })
  assert.equal(harness.xhr.method, 'POST')
  assert.equal(harness.xhr.url, `https://storage.example/storage/v1/object/community-media/${draft.mediaPath}`)
  assert.equal(harness.xhr.headers.Authorization, 'Bearer member-token')
  assert.equal(harness.xhr.headers.apikey, 'public-key')
  assert.equal(harness.xhr.headers['x-upsert'], 'false')
  assert.deepEqual(progress, [50])
})

test('expired sessions and canceled uploads cannot proceed to storage completion', async () => {
  const noSession = uploadHarness()
  await assert.rejects(uploadCommunityMedia({ ...noSession.options, getAccessToken: async () => undefined }), /Sign in again/)
  assert.equal(noSession.calls.length, 0)
  const harness = uploadHarness({ status: 200, pending: true })
  const controller = new AbortController()
  const pending = uploadCommunityMedia({ ...harness.options, signal: controller.signal })
  await new Promise((resolve) => setImmediate(resolve))
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(harness.xhr.aborted, true)
})

test('failed uploads remain retryable and exact duplicate-object responses continue to server validation', async () => {
  for (const response of [{ status: 403 }, { status: 400, body: { error: 'InvalidMimeType' } }, { status: 0, networkError: true }, { status: 0, timeout: true }]) {
    const harness = uploadHarness(response)
    await assert.rejects(uploadCommunityMedia(harness.options), /upload/i)
  }
  for (const response of [{ status: 409 }, { status: 400, body: { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' } }]) {
    const harness = uploadHarness(response)
    await uploadCommunityMedia(harness.options)
    assert.equal(harness.calls.length, 1)
  }
})

test('failed upload followed by retry reserves the same post and publishes exactly once', async () => {
  const requests = [], stages = []
  let attempts = 0, publishes = 0
  const request = async (url, options) => {
    requests.push({ url, body: options.body && JSON.parse(options.body) })
    if (url.endsWith('/publish')) { publishes++; return { post } }
    return { draft }
  }
  const upload = async () => { if (++attempts === 1) throw new Error('Network interrupted') }
  const options = { input, file: image, signal: new AbortController().signal, onStage: (stage) => stages.push(stage), onProgress: noop, request, upload }
  await assert.rejects(submitCommunityPost(options), /Network interrupted/)
  assert.equal(publishes, 0)
  assert.equal((await submitCommunityPost(options)).id, id)
  assert.equal(publishes, 1)
  assert.deepEqual(requests.filter((entry) => entry.body).map((entry) => entry.body.id), [id, id])
  assert.deepEqual(stages, ['saving', 'uploading', 'saving', 'uploading', 'publishing'])
})

test('text post and recovered published response never trigger a new media upload or duplicate publish', async () => {
  for (const value of [{ ...input, media: null }, input]) {
    let requestCalls = 0
    const result = await submitCommunityPost({ input: value, file: value.media ? image : null, signal: new AbortController().signal, onStage: noop, onProgress: noop, request: async () => { requestCalls++; return { post } }, upload: async () => { assert.fail('Recovered posts must not reupload') } })
    assert.equal(result.id, id)
    assert.equal(requestCalls, 1)
  }
})

test('reloading a pending post reconciles a completed upload without requiring a second file', async () => {
  const urls = []
  const result = await submitCommunityPost({ input, file: null, signal: new AbortController().signal, onStage: noop, onProgress: noop, request: async (url) => { urls.push(url); return url.endsWith('/publish') ? { post } : { draft } }, upload: async () => assert.fail('No local file after reload') })
  assert.equal(result.id, id)
  assert.deepEqual(urls, ['/api/community/posts', `/api/community/posts/${id}/publish`])
})

test('missing media and canceled uploads never publish or create another post identifier', async () => {
  let publishes = 0
  const request = async (url) => { if (url.endsWith('/publish')) { publishes++; throw new CommunityRequestError('Not uploaded', 409, 'MEDIA_MISSING') } return { draft } }
  await assert.rejects(submitCommunityPost({ input, file: null, signal: new AbortController().signal, onStage: noop, onProgress: noop, request }), (error) => error.code === 'MEDIA_MISSING')
  assert.equal(publishes, 1)
  publishes = 0
  await assert.rejects(submitCommunityPost({ input, file: image, signal: new AbortController().signal, onStage: noop, onProgress: noop, request, upload: async () => { throw new DOMException('Canceled', 'AbortError') } }), { name: 'AbortError' })
  assert.equal(publishes, 0)
  assert.equal(input.id, id)
})

test('API errors preserve explicit retry codes and reject incomplete success responses', async () => {
  await assert.rejects(communityRequest('/api/community/posts', {}, async () => ({ ok: false, status: 409, json: async () => ({ error: 'Attachment missing', code: 'MEDIA_MISSING' }) })), (error) => error.status === 409 && error.code === 'MEDIA_MISSING')
  await assert.rejects(communityRequest('/api/community/posts', {}, async () => ({ ok: true, json: async () => { throw new Error('bad response') } })), /incomplete/)
})
