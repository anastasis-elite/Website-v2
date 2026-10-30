import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'

const { createPracticeTimeline, getPracticeFrame } = await importTs('lib/meditation/practiceTiming.ts')

test('Breath Reset has exactly seven complete inhale/exhale/post-exhale hold rounds', () => {
  const timeline = createPracticeTimeline('breath-reset')
  assert.equal(timeline.durationMs, 114500)
  assert.equal(timeline.rounds, 7)
  assert.equal(timeline.phases.length, 21)
  const expected = [[4000, 6000, 1000], [4500, 7000, 1000], [5000, 8000, 2000], [5500, 9000, 2000], [6000, 10000, 2000], [6500, 11000, 2000], [7000, 12000, 3000]]
  expected.forEach((durations, index) => {
    const phases = timeline.phases.slice(index * 3, index * 3 + 3)
    assert.deepEqual(phases.map(item => item.phase), ['Inhale', 'Exhale', 'Hold'])
    assert.deepEqual(phases.map(item => item.durationMs), durations)
    assert.ok(phases.every(item => item.round === index + 1))
  })
  assert.equal(getPracticeFrame(timeline, 111500).phase, 'Hold')
  assert.equal(getPracticeFrame(timeline, 114499).finished, false)
  assert.equal(getPracticeFrame(timeline, 114500).finished, true)
  assert.equal(getPracticeFrame(timeline, 999999).round, 7)
})

test('Sleep Wind Down stops at 7.5/13 after 36 rounds and includes the threshold hold', () => {
  const timeline = createPracticeTimeline('sleep-wind-down')
  assert.equal(timeline.durationMs, 606000)
  assert.equal(timeline.rounds, 36)
  assert.equal(timeline.phases.length, 108)
  for (let index = 0; index < 36; index++) {
    const phases = timeline.phases.slice(index * 3, index * 3 + 3)
    assert.deepEqual(phases.map(item => item.phase), ['Inhale', 'Exhale', 'Hold'])
    assert.deepEqual(phases.map(item => item.durationMs), [4000 + 100 * index, 6000 + 200 * index, index < 15 ? 1000 : 2000])
    assert.ok(phases.every(item => item.round === index + 1))
  }
  assert.deepEqual(timeline.phases.slice(42, 48).map(item => item.durationMs), [5400, 8800, 1000, 5500, 9000, 2000])
  assert.deepEqual(timeline.phases.slice(-3).map(item => item.durationMs), [7500, 13000, 2000])
  assert.equal(getPracticeFrame(timeline, 604000).phase, 'Hold')
  assert.equal(getPracticeFrame(timeline, 605999).finished, false)
  assert.equal(getPracticeFrame(timeline, 606000).finished, true)
  assert.equal(getPracticeFrame(timeline, 999999).round, 36)
})

test('one elapsed timeline drives exact phase boundaries, countdown, and orb motion', () => {
  for (const id of ['breath-reset', 'sleep-wind-down']) {
    const timeline = createPracticeTimeline(id)
    timeline.phases.forEach((phase, index) => {
      const start = getPracticeFrame(timeline, phase.startMs)
      assert.equal(start.phase, phase.phase)
      assert.equal(start.round, phase.round)
      assert.equal(start.phaseRemainingMs, phase.durationMs)
      assert.equal(start.phaseProgress, 0)
      assert.equal(start.finished, false)
      assert.equal(start.orbScale, phase.phase === 'Exhale' ? 1 : 0.82)
      const midpoint = getPracticeFrame(timeline, phase.startMs + phase.durationMs / 2)
      assert.equal(midpoint.phaseProgress, 0.5)
      assert.equal(midpoint.phaseRemainingMs, phase.durationMs / 2)
      assert.ok(Math.abs(midpoint.orbScale - (phase.phase === 'Hold' ? 0.82 : 0.91)) < 1e-10)
      assert.equal(getPracticeFrame(timeline, phase.endMs - 1).phase, phase.phase)
      const end = getPracticeFrame(timeline, phase.endMs)
      assert.equal(end.finished, index === timeline.phases.length - 1)
      if (!end.finished) {
        assert.equal(end.phase, timeline.phases[index + 1].phase)
        assert.equal(end.phaseProgress, 0)
      } else {
        assert.equal(end.phaseRemainingMs, 0)
        assert.equal(end.orbScale, 0.82)
      }
    })
    assert.deepEqual(getPracticeFrame(timeline, -1), getPracticeFrame(timeline, 0))
  }
})

test('skipping holds retains all rounds and recalculates actual duration including the last exhale', () => {
  for (const [id, durationMs, rounds] of [['breath-reset', 101500, 7], ['sleep-wind-down', 549000, 36]]) {
    const timeline = createPracticeTimeline(id, true)
    assert.equal(timeline.durationMs, durationMs)
    assert.equal(timeline.rounds, rounds)
    assert.equal(timeline.phases.length, rounds * 2)
    assert.ok(timeline.phases.every(item => item.phase !== 'Hold'))
    const original = createPracticeTimeline(id).phases.filter(item => item.phase !== 'Hold')
    assert.deepEqual(timeline.phases.map(item => [item.phase, item.durationMs, item.round]), original.map(item => [item.phase, item.durationMs, item.round]))
    assert.equal(getPracticeFrame(timeline, durationMs - 1).phase, 'Exhale')
    assert.equal(getPracticeFrame(timeline, durationMs - 1).finished, false)
    assert.equal(getPracticeFrame(timeline, durationMs).finished, true)
  }
})

test('other presets preserve durations and four-second inhale/exhale timing', () => {
  for (const [id, durationMs] of [['calm-reset', 300000], ['recovery-meditation', 480000]]) {
    const timeline = createPracticeTimeline(id)
    assert.equal(timeline.durationMs, durationMs)
    assert.equal(timeline.rounds, null)
    assert.deepEqual(createPracticeTimeline(id, true), timeline)
    for (let elapsed = 0; elapsed < durationMs; elapsed += 1000) {
      const frame = getPracticeFrame(timeline, elapsed)
      assert.equal(frame.phase, Math.floor(elapsed / 4000) % 2 === 0 ? 'Inhale' : 'Exhale')
      assert.equal(frame.phaseRemainingMs, 4000 - elapsed % 4000)
      assert.equal(frame.finished, false)
    }
    assert.equal(getPracticeFrame(timeline, durationMs).finished, true)
  }
})
