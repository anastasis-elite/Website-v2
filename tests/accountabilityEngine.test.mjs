import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const moduleCache = new Map()

function loadCommonJsTypescript(filePath) {
  const absolutePath = path.resolve(filePath)
  if (moduleCache.has(absolutePath)) return moduleCache.get(absolutePath).exports

  const source = readFileSync(absolutePath, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText
  const module = { exports: {} }
  moduleCache.set(absolutePath, module)

  const localRequire = (id) => {
    if (id.startsWith('@/')) return loadCommonJsTypescript(id.replace('@/', ''))
    if (id.startsWith('.')) {
      const candidate = path.resolve(path.dirname(absolutePath), id)
      return loadCommonJsTypescript(candidate.endsWith('.ts') ? candidate : `${candidate}.ts`)
    }
    return {}
  }

  vm.runInNewContext(compiled, { exports: module.exports, module, require: localRequire })
  return module.exports
}

const { evaluateResilience } = loadCommonJsTypescript('lib/dashboard/resilienceEngine.ts')
const { runAccountabilityPartnerEngine } = loadCommonJsTypescript('lib/accountability/accountabilityEngine.ts')
const { buildNatalProfile } = loadCommonJsTypescript('lib/accountability/astrologyProfile.ts')
const { deriveCommunicationProfileFromNatalProfile, applyExplicitPreferences } = loadCommonJsTypescript('lib/accountability/communicationProfile.ts')
const { refineProfileFromBehavior } = loadCommonJsTypescript('lib/accountability/accountabilityFeedback.ts')

function response(input, overrides = {}) {
  const resilienceState = evaluateResilience(input)
  return runAccountabilityPartnerEngine({
    clientId: 'client-test',
    resilienceState,
    dailyInsight: {
      id: 'test',
      date: '2026-08-27',
      category: 'general',
      message: 'Objective insight.',
    },
    ...overrides,
  })
}

test('diligence needed uses action-oriented tone without unnecessary recovery', () => {
  const result = response({
    sleepHours: 8,
    hrv: 62,
    soreness: 2,
    energy: 8,
    steps: 1200,
    workoutMinutes: 0,
    recoveryStatus: 'normal_training_day',
    fuelStatus: 'well_fueled',
  }, { availableTime: 45 })

  assert.equal(result.mode, 'challenge')
  assert.match(result.message, /body is ready|Go do the work|This is the window/)
  assert.doesNotMatch(result.message, /more recovery/i)
})

test('patience needed discourages intensity with grounded tone', () => {
  const result = response({
    sleepHours: 5,
    hrv: 27,
    soreness: 8,
    energy: 3,
    workoutMinutes: 90,
    recoveryStatus: 'modify_workout',
  })

  assert.equal(result.mode, 'ground')
  assert.match(result.message, /More is not better|stimulus|build/)
})

test('kindness needed avoids punishment language and returns to normal plan', () => {
  const result = response({
    sleepHours: 7.4,
    hrv: 56,
    soreness: 2,
    energy: 7,
    missedWorkoutYesterday: true,
    workoutMinutes: 0,
    recoveryStatus: 'normal_training_day',
    fuelStatus: 'well_fueled',
  })

  assert.equal(result.mode, 'encourage')
  assert.match(result.message, /does not need to be paid for|today/)
  assert.doesNotMatch(result.message, /punish|earn|make up/i)
})

test('generosity imbalance protects capacity without forcing another task', () => {
  const result = response({
    sleepHours: 5.7,
    stress: 9,
    energy: 4,
    scheduleDensity: 'packed',
    openWindowMinutes: 15,
    recoveryStatus: 'normal_training_day',
  }, { scheduleLoad: 'packed', availableTime: 15 })

  assert.equal(result.mode, 'protect')
  assert.match(result.message, /last piece|Protect/)
  assert.doesNotMatch(result.message, /cram|go do the work/i)
})

test('explicit user preference overrides higher-challenge natal hypothesis', () => {
  const natalProfile = {
    placements: {
      mars: { body: 'mars', sign: 'aries', confidence: 1 },
      mercury: { body: 'mercury', sign: 'capricorn', confidence: 1 },
    },
    confidence: 1,
  }
  const natal = deriveCommunicationProfileFromNatalProfile(natalProfile)
  const explicit = applyExplicitPreferences(natal, {
    supportPreference: 'encourage_without_pressure',
  })

  assert.ok(natal.challengeIntensity > explicit.challengeIntensity)

  const result = response({
    sleepHours: 8,
    hrv: 62,
    soreness: 2,
    energy: 8,
    steps: 1200,
    workoutMinutes: 0,
    recoveryStatus: 'normal_training_day',
    fuelStatus: 'well_fueled',
  }, {
    natalProfile,
    userPreferences: { supportPreference: 'encourage_without_pressure' },
  })

  assert.ok(result.communicationProfile.challengeIntensity < natal.challengeIntensity)
  assert.match(result.reasoningTags.join(','), /source:explicit_preference/)
})

test('observed behavior gradually lowers challenge intensity', () => {
  const profile = deriveCommunicationProfileFromNatalProfile({
    placements: {
      mars: { body: 'mars', sign: 'aries', confidence: 1 },
      mercury: { body: 'mercury', sign: 'capricorn', confidence: 1 },
    },
    confidence: 1,
  })
  const refined = refineProfileFromBehavior(profile, {
    highChallengeDismissalRate: 0.7,
    supportivePromptCompletionRate: 0.75,
    directPromptCompletionRate: 0.25,
    concisePromptCompletionRate: 0.7,
    sampleSize: 12,
  })

  assert.ok(refined.challengeIntensity < profile.challengeIntensity)
  assert.ok(profile.challengeIntensity - refined.challengeIntensity < 0.2)
})

test('astrology unavailable still produces partner response', () => {
  const result = response({
    sleepHours: 7,
    soreness: 3,
    energy: 6,
    recoveryStatus: 'normal_training_day',
  }, {
    natalProfile: { placements: {}, aspects: [], confidence: 0, unavailableReason: 'missing' },
    userPreferences: { supportPreference: 'make_next_step_smaller' },
  })

  assert.ok(result.partner.name)
  assert.ok(result.message.length > 10)
  assert.match(result.reasoningTags.join(','), /source:no_natal/)
})

test('birth time unavailable does not fabricate ascendant or houses', () => {
  const natalProfile = buildNatalProfile({
    birthData: {
      dateOfBirth: '1990-01-01',
      birthTimeKnown: false,
    },
    storedProfile: {
      placements: {
        sun: { body: 'sun', sign: 'capricorn', confidence: 0.8 },
        ascendant: { body: 'ascendant', sign: 'leo', confidence: 0.1 },
      },
      houses: [{ house: 1, sign: 'leo', confidence: 0.1 }],
      confidence: 0.5,
    },
  })

  assert.equal(natalProfile.placements.ascendant, undefined)
  assert.equal(natalProfile.houses, undefined)
})

test('safety override blocks motivational pressure', () => {
  const result = response({
    sleepHours: 8,
    hrv: 62,
    soreness: 1,
    energy: 8,
    symptomRedFlag: true,
    workoutMinutes: 70,
    recoveryStatus: 'push_day',
    fuelStatus: 'well_fueled',
  })

  assert.equal(result.mode, 'protect')
  assert.match(result.message, /not a grit problem|symptoms need attention/)
  assert.doesNotMatch(result.message, /push through|tough enough/i)
})

test('completed day permits rest and does not invent productivity', () => {
  const resilienceState = evaluateResilience({
    sleepHours: 7.5,
    hrv: 52,
    soreness: 2,
    energy: 7,
    workoutComplete: true,
    workoutMinutes: 35,
    steps: 7000,
    hydrationPercent: 85,
    fuelStatus: 'well_fueled',
    recoveryStatus: 'normal_training_day',
  })

  const result = runAccountabilityPartnerEngine({
    clientId: 'client-test',
    resilienceState: { ...resilienceState, priority: 'optimization' },
    dailyInsight: {
      id: 'done',
      date: '2026-08-27',
      category: 'progress',
      message: 'You have already followed through.',
    },
  })

  assert.equal(result.mode, 'celebrate')
  assert.match(result.message, /done|Go live your life/)
  assert.doesNotMatch(result.message, /next task|more/i)
})
