import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { postureLandmarkDefinitions } = await importTs('lib/posture/landmarks.ts')
const { POST } = await importTs('app/api/assessment-photos/landmarks/route.ts', {
  'next/server': 'export const NextResponse={json:(body,options)=>Response.json(body,options)}',
  '@/lib/supabase/server': 'export async function createClient(){return globalThis.__manualPostureSaveFixture.db}',
})
const plain = value => JSON.parse(JSON.stringify(value))
const owner = 'QA-OWNER', clientId = 'QA-CLIENT', photoId = 'QA-PHOTO'

function fixture(options = {}) {
  const state = { ...options, user: options.user === null ? null : { id: owner }, program: options.program || 'ignite',
    photo: { id: photoId, client_id: clientId, auth_user_id: options.photoOwner || owner,
      front_photo_url: `${clientId}/front.jpg`, landmark_metadata: {}, ...options.photo },
    prior: plain(options.prior || []), calls: [], rowWrites: [], photoWrites: [] }
  state.db = { auth: { async getUser() { return { data: { user: state.user } } } }, from(table) {
    const query = { table, filters: {}, operation: 'select', payload: null,
      select(value) { this.columns = value;return this }, eq(key, value) { this.filters[key] = value;return this },
      upsert(value) { this.operation = 'upsert';this.payload = plain(value);return this },
      update(value) { this.operation = 'update';this.payload = plain(value);return this },
      maybeSingle() { return this.result() },
      async result() {
        state.calls.push({ table, operation: this.operation, filters: { ...this.filters } })
        if (table === 'assessment_photos' && this.operation === 'select') {
          return { data: this.filters.id === state.photo.id && this.filters.auth_user_id === state.photo.auth_user_id ? plain(state.photo) : null, error: null }
        }
        if (table === 'clients') return { data: this.filters.client_id === clientId && this.filters.auth_user_id === owner && state.clientOwner !== 'OTHER'
          ? { client_id: clientId, program: state.program } : null, error: null }
        if (table === 'posture_photo_landmarks' && this.operation === 'select') return { data: plain(state.prior), error: state.priorError || null }
        if (this.operation === 'upsert') {
          state.rowWrites.push(this.payload)
          if (!state.upsertError) state.prior = this.payload
          return { error: state.upsertError || null }
        }
        if (this.operation === 'update') {
          state.photoWrites.push(this.payload)
          if (!state.photoUpdateError) state.photo = { ...state.photo, ...this.payload }
          return { error: state.photoUpdateError || null }
        }
        throw new Error(`Unexpected synthetic query: ${table}`)
      }, then(resolve, reject) { return this.result().then(resolve, reject) },
    };return query
  } }
  globalThis.__manualPostureSaveFixture = state
  return state
}
function body(view = 'front', complete = false) {
  const definitions = postureLandmarkDefinitions(view)
  return { assessmentPhotoId: photoId, view, path: `${clientId}/${view}.jpg`, imageWidth: 900, imageHeight: 1200,
    detectionStatus: 'manual', rawLandmarks: [], landmarks: definitions.map((item, index) => {
      const confirmed = item.visible && (complete || index === 0) ? { x: 0, y: Math.min(.95, index / 30) } : null
      return { ...item, automatic: null, confirmed, manuallyAdjusted: Boolean(confirmed), lowConfidence: false }
    }) }
}
const save = async input => { const response = await POST(new Request('https://example.test/api/assessment-photos/landmarks', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
}));return { status: response.status, data: await response.json() } }

test('partial manual view saves unknown points honestly with no new automatic coordinates or confidence', async () => {
  const current = fixture(), input = body(), result = await save(input)
  assert.equal(result.status, 200);assert.equal(result.data.success, true)
  assert.equal(result.data.complete, false);assert.equal(result.data.allViewsComplete, false)
  assert.equal(result.data.confirmedCount, 1)
  assert.equal(result.data.visibleCount, input.landmarks.filter(item => item.visible).length)
  const rows = current.rowWrites[0]
  assert.ok(rows.every(row => row.automatic_x === null && row.automatic_y === null && row.detection_confidence === null))
  assert.equal(rows[0].confirmed_x, 0);assert.equal(rows[0].manually_adjusted, true)
  assert.equal(rows[1].confirmed_x, null);assert.equal(rows[1].manually_adjusted, false)
  assert.ok(rows.every(row => row.detection_status === 'manual_partial' && row.detection_metadata.placement_method === 'manual'))
  assert.equal(current.photoWrites[0].landmark_status, 'partial')
  assert.equal(Object.hasOwn(current.photoWrites[0], 'posture_landmarks_confirmed_at'), false)
})

test('complete side view requires only its visible anatomical landmarks and retains hidden points as unknown', async () => {
  const current = fixture({ program: 'phoenix', photo: { front_photo_url: null, left_photo_url: `${clientId}/left.jpg` } })
  const input = body('left', true), result = await save(input)
  assert.equal(result.status, 200);assert.equal(result.data.complete, true);assert.equal(result.data.allViewsComplete, true)
  assert.equal(result.data.visibleCount, 11)
  const rows = current.rowWrites[0]
  assert.ok(rows.filter(row => !row.visible).every(row => row.confirmed_x === null && !row.manually_adjusted))
  assert.equal(current.photoWrites[0].landmark_status, 'confirmed')
  assert.ok(current.photoWrites[0].posture_landmarks_confirmed_at)
})

test('one complete view does not claim an uploaded second view complete and a later confirmed view completes the photo', async () => {
  const current = fixture({ photo: { back_photo_url: `${clientId}/back.jpg`, landmark_metadata: { retained: 'history' } } })
  const first = await save(body('front', true))
  assert.equal(first.data.complete, true);assert.equal(first.data.allViewsComplete, false)
  assert.equal(current.photo.landmark_status, 'partial');assert.equal(current.photo.landmark_metadata.retained, 'history')
  const second = await save(body('back', true))
  assert.equal(second.status, 200);assert.equal(second.data.allViewsComplete, true)
  assert.equal(current.photo.landmark_status, 'confirmed')
  assert.equal(current.photo.landmark_metadata.manual_views.front.complete, true)
  assert.equal(current.photo.landmark_metadata.manual_views.back.complete, true)
})

test('zero, forged, invisible, nonfinite or invented-confidence manual points reject before writes', async () => {
  const mutations = [
    input => input.landmarks.forEach(item => { item.confirmed = null;item.manuallyAdjusted = false }),
    input => { input.landmarks[0].confirmed.x = Infinity },
    input => { input.landmarks[0].confirmed.x = 2 },
    input => { input.landmarks[0].confirmed.confidence = .9 },
    input => { input.landmarks[0].automatic = { x: .2, y: .3 } },
    input => { input.landmarks[0].side = 'left' },
    input => { input.landmarks[0].view = 'right' },
    input => { input.landmarks[0].lowConfidence = true },
    input => { input.landmarks[1] = input.landmarks[0] },
    input => { input.rawLandmarks = [{ name: 'guessed', x: .4, y: .5 }] },
    input => { input.imageWidth = 0 },
  ]
  for (const mutate of mutations) {
    const current = fixture(), input = body();mutate(input)
    assert.equal((await save(input)).status, 400)
    assert.equal(current.rowWrites.length, 0);assert.equal(current.photoWrites.length, 0)
  }
  const current = fixture({ photo: { front_photo_url: null, left_photo_url: `${clientId}/left.jpg` } }), input = body('left')
  const hidden = input.landmarks.find(item => !item.visible);hidden.confirmed = { x: .5, y: .5 };hidden.manuallyAdjusted = true
  assert.equal((await save(input)).status, 400);assert.equal(current.rowWrites.length, 0)
})

test('manual resave retains prior automatic provenance and original photo history without nesting it on retry', async () => {
  const originalMetadata = { message: 'Historical estimate', rawLandmarks: [{ name: 'old', x: .1, y: .2 }] }
  const current = fixture({ prior: [{ landmark_name: 'head_top', automatic_x: 0, automatic_y: .25, detection_confidence: 0,
    detection_status: 'detected', detection_metadata: originalMetadata }],
    photo: { posture_landmarks_confirmed_at: '2026-01-01T12:00:00Z', landmark_metadata: { prior: 'retained' } } })
  assert.equal((await save(body())).status, 200)
  const first = current.rowWrites[0][0]
  assert.deepEqual([first.automatic_x, first.automatic_y, first.detection_confidence], [0, .25, 0])
  assert.deepEqual(first.detection_metadata.previous_detection, { status: 'detected', metadata: originalMetadata })
  assert.equal(current.photo.posture_landmarks_confirmed_at, '2026-01-01T12:00:00Z')
  assert.equal(current.photo.landmark_metadata.prior, 'retained')
  assert.equal((await save(body())).status, 200)
  assert.deepEqual(current.rowWrites[1][0].detection_metadata.previous_detection, first.detection_metadata.previous_detection)
})

test('authentication, owned photo/client and existing tier gates remain before landmark writes', async () => {
  for (const [options, expected] of [[{ user: null }, 401], [{ photoOwner: 'OTHER' }, 404], [{ clientOwner: 'OTHER' }, 404],
    [{ program: 'ember' }, 403], [{ program: 'free' }, 403], [{ program: 'tracker' }, 403]]) {
    const current = fixture(options), result = await save(body())
    assert.equal(result.status, expected);assert.equal(current.rowWrites.length, 0);assert.equal(current.photoWrites.length, 0)
  }
  const current = fixture(), wrong = body();wrong.path = 'OTHER/front.jpg'
  assert.equal((await save(wrong)).status, 409);assert.equal(current.rowWrites.length, 0)
})

test('read/write failures remain unconfirmed and retry retains the same manual points', async () => {
  const unread = fixture({ priorError: { message: 'Synthetic read failure' } })
  assert.equal((await save(body())).status, 500);assert.equal(unread.rowWrites.length, 0)
  const rejected = fixture({ upsertError: { message: 'Synthetic write failure' } })
  assert.equal((await save(body())).status, 500);assert.equal(rejected.photoWrites.length, 0)
  const partialWrite = fixture({ photoUpdateError: { message: 'Synthetic metadata failure' } }), input = body()
  const failed = await save(input)
  assert.equal(failed.status, 500);assert.match(failed.data.error, /could not be confirmed/)
  partialWrite.photoUpdateError = null
  assert.equal((await save(input)).status, 200)
  assert.deepEqual(partialWrite.rowWrites[1].map(row => [row.confirmed_x, row.confirmed_y]), partialWrite.rowWrites[0].map(row => [row.confirmed_x, row.confirmed_y]))
})

test('legacy automatic receipt writes remain compatible without deleting or relabeling stored historical records', async () => {
  const current = fixture(), input = body()
  input.detectionStatus = 'partial';input.rawLandmarks = [{ name: 'legacy', x: .3, y: .4 }]
  input.landmarks[0].automatic = { x: .2, y: .3, confidence: .8 }
  const result = await save(input)
  assert.equal(result.status, 200)
  assert.equal(current.rowWrites[0][0].detection_status, 'partial')
  assert.equal(current.rowWrites[0][0].automatic_x, .2)
  assert.deepEqual(current.rowWrites[0][0].detection_metadata.rawLandmarks, input.rawLandmarks)
  assert.equal(current.calls.some(call => call.operation === 'delete'), false)
})
