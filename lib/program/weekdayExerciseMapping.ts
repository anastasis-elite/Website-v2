import 'server-only'

import { createHash } from 'node:crypto'
import ember from '@/data/template/emberGym.json'
import ignite from '@/data/template/igniteGym.json'
import phoenixBodybuilding from '@/data/template/phoenixBodybuilding.json'
import phoenixEndurance from '@/data/template/phoenixEndurance.json'
import phoenixFullTransformation from '@/data/template/phoenixFullTransformation.json'
import phoenixGluteSculpt from '@/data/template/phoenixGluteSculpt.json'
import phoenixHypertrophy from '@/data/template/phoenixHypertrophy.json'
import phoenixRecomposition from '@/data/template/phoenixRecomposition.json'
import phoenixStrength from '@/data/template/phoenixStrength.json'
import phoenixWaistCincher from '@/data/template/phoenixWaistCincher.json'
import exerciseVariants from '@/data/reference/exerciseVariants.json'
import { WEEKDAYS } from '@/lib/program/weekdayMuscleTypes'
import type { Weekday } from '@/lib/program/weekdayMuscleTypes'
import type { CanonicalMuscle } from '@/lib/workout-os/types'

/** Sidecar metadata only: this does not amend the catalog or saved prescriptions. */
export const WEEKDAY_EXERCISE_MAPPING_VERSION = 'exact-template-placement-v1'

export type WeekdayExerciseMapping = {
  kind: 'movable'
  primaryMuscles: CanonicalMuscle[]
  basis: string
} | {
  kind: 'pinned'
  category: 'ambiguous' | 'non_strength' | 'unknown'
  reason: string
  ownerDecision: string
}

export type WeekdayMappingProvenance = {
  templateProgram: string
  templateVersion: string
  mappingVersion: string
  sourceTemplateContentSha256: string
}

export type VersionedWeekdayExerciseMappings = {
  status: 'compatible'
  provenance: WeekdayMappingProvenance
  occurrences: Array<{ day: Weekday; index: number; exercise: Record<string, unknown>; mapping: WeekdayExerciseMapping }>
  missingWeekdays: Weekday[]
} | {
  status: 'unsupported'
  issues: Array<{ code: string; message: string; day?: string; exercise?: string }>
}

type SourceTemplate = { program: string; version: string; days: Array<{ day_name: string; day_intent: string; focus: string; exercises: Record<string, unknown>[] }> }

// Digests cover JSON content, including every occurrence and dose. A changed
// source carrying the same v1 label needs an explicit new compatibility review.
const sources: Record<string, { template: SourceTemplate; contentSha256: string }> = {
  ember: { template: ember, contentSha256: '37a888963fba2f09af7788bd75106d07cc687d6cf691c7596c9a2e89213423ff' },
  ignite: { template: ignite, contentSha256: 'b298b234543d665f3b9b5486a85ea845f3d6a7a3e0ed7434f28063e8be03aabb' },
  phoenixBodybuilding: { template: phoenixBodybuilding, contentSha256: 'c1b803a997a339b4ffe93c87db2cb516f131b1b15c158986b0db4876f103ea35' },
  phoenixEndurance: { template: phoenixEndurance, contentSha256: 'd4bfe6375c57063c8e3968295eb2d4441aba0d798c2a1b70e822b53a137ea13b' },
  phoenixFullTransformation: { template: phoenixFullTransformation, contentSha256: 'bb9e1e39988f0116a65c92dac041ba35fbc54d3f9c1f60f3bdaf846c2ecdeafb' },
  phoenixGluteSculpt: { template: phoenixGluteSculpt, contentSha256: '5372160dfd3c858138dac29e4fdf3d74a9a6d1a7223cea4415907bfe3fbec978' },
  phoenixHypertrophy: { template: phoenixHypertrophy, contentSha256: '9eb2a234be62e53e3404923f95a55cd7eea59b8aa54b02e0a03bb99939259012' },
  phoenixRecomposition: { template: phoenixRecomposition, contentSha256: '3d7908f33d5ad23737cbea677a944f50386590a9fd5d635128f8efaaf80bdc6f' },
  phoenixStrength: { template: phoenixStrength, contentSha256: '3fa7ba600ffd1dc667c04a529c59896d40268c470ad7c3f3216f611c5290f5a6' },
  phoenixWaistCincher: { template: phoenixWaistCincher, contentSha256: 'e079866350c6b6c1e1f8ddea053fef925b3cc4bbf3a77fa629cbbf4f4782fa3a' },
}

// Exact identities only. These placements use an explicit anatomical name or
// an unambiguous named movement; compound/unspecified intended placement stays
// with its source weekday. No substring, secondary-muscle or readiness inference.
const clearPlacements: Partial<Record<CanonicalMuscle, readonly string[]>> = {
  chest: ['Bench Press', 'Incline Press', 'Incline Dumbbell Press', 'High Cable Fly', 'Low Cable Fly'],
  shoulders: ['Arnold Press', 'Cable Front Raise', 'Dumbbell Front Raise', 'Cable Lateral', 'Cable Lateral Raise',
    'Dumbbell Lateral Raise', 'Lateral Raise', 'Lateral Raises', 'Cable Rear Delt Fly', 'High Cable Rear Delt Pull',
    'High Cable Rear Fly', 'Rear Delt Cable Fly', 'Rear Delt Fly', 'Rear Delt Machine', 'Reverse Pec Deck',
    'Machine Shoulder Press', 'Shoulder Press', 'Shoulder Press Machine', 'Smith Machine Press'],
  lats: ['Lat Pulldown', 'Close-Grip Lat Pulldown', 'Wide-Grip Lat Pulldown', 'Straight-Arm Lat Pulldown',
    'Single-Arm Lat Pulldown', 'Straight Arm Rope Pulldown'],
  biceps: ['Cable Bicep Curl', 'Dumbbell Bicep Curl', 'Rope Biceps Curl'],
  triceps: ['Rope Tricep Extension'],
  hamstrings: ['Lying Ham Curls', 'Seated Ham Curl', 'Seated Single Ham Curl'],
  quads: ['Leg Extension', 'Sissy Squat'],
  glutes: ['B-Stance Hip Thrust', 'Barbell Glute Bridge', 'Barbell Hip Thrust', 'Dumbbell Glute Bridge',
    'Dumbbell Hip Thrust', 'Glute Bridge Machine', 'Glute-Only Back Extension', 'Hip Thrust', 'Hip Thrust Holds',
    'KAS Glute Bridge', 'Machine Glute Bridge', 'Machine Hip Thrust', 'Single-Leg Glute Bridge',
    'Smith Machine Glute Bridge', 'Smith Machine Hip Thrust', 'Back Extension (Glute-45*)', 'Leg Press (Glute)',
    'Frog Pump', 'Frog Pumps'],
  adductors: ['Adductor Machine', 'Cable Adduction', 'Machine Adduction'],
  core: ['Barbell Rollout', 'Cable Crunch', 'Cable Twist', 'Deadbug', 'Pallof Press', 'Reverse Crunch',
    'Side Plank', 'TRX Crunch', 'TVA Hold', 'TVA Holds', 'Woodchops', 'Lower Ab Cable Pull'],
  upper_traps: ['Shrug Hold'],
}

const nonStrength = new Set(['Breathwork', 'Cooldown Walk', 'Elliptical', 'Endurance Interval', 'Glute Stretch',
  'Hip Flexor Release', 'Incline Walk', 'Optional Walk', 'Rower', 'Stair Stepper',
  'Steady State Walk', 'Stretching', 'Walking/Running'])
const unspecifiedBlocks = new Set(['Arm Circuit', 'Band Burnout Circuit', 'Core Finisher', 'Delt Pump Finisher',
  'Glute Finisher', 'Shoulder Pump Finisher', 'Banded Hip Abduction Finisher'])
const ambiguousIdentities = new Set(['45* Back Extension', 'Abduction Machine', 'B Stance RDL', 'Back Extension',
  'Banded Abduction', 'Barbell RDL', 'Barbell Row', 'Barbell Squat', 'Barbell Upright Row', 'Bent-Knee Kickback',
  'Bodyweight Squats', 'Bulgarian Split Squat', 'Cable Abduction', 'Cable Kickback', 'Cable Kickback (Straight Leg)',
  'Cable Kickbacks', 'Cable Pull-Through', 'Cable RDL', 'Cable Row', 'Chest Supported Row', 'Dumbbell Lunge', 'Dumbbell Press',
  'Dumbbell RDL', 'Dumbbell Upright Row', 'Elevated Goblet Squat', 'Face Pull', 'Facepull', 'Goblet Squat',
  'Hack Press', 'Hack Squat', 'Hammer Curl', 'Hamstring Lengthening', 'Hanging Knee Raise', 'Hyper Extension', 'Kickbacks (Bent)',
  'Landmine Row', 'Lateral Lunge', 'Lateral Step Up', 'Lateral Step-Up', 'Leg Press', 'Leg Raise', 'Machine Kickback',
  'Machine Row', 'Meadows Row', 'Reverse Hyper', 'Reverse Hyperextension', 'Reverse Lunge', 'Rope Pulldown',
  'Seated Abduction', 'Seated Cable Row', 'Single Arm Lat Row', 'Single-Arm Cable Row', 'Single-Arm Dumbbell Row', 'Single-Leg Leg Press',
  'Single-Leg RDL', 'Smith Machine Lunge', 'Smith Machine RDL', 'Smith Machine Split Squat', 'Split Squat',
  'Standing Abduction', 'Standing Cable Abduction', 'Step-Around Lunges', 'Step-Up', 'Step-Ups', 'Step-up',
  'Suitcase Carry', 'Sumo Squat', 'T-Bar Row', 'Upright Cable Row', 'Vertical Leg Press', 'Walking Lunge',
  'Walking Lunges', 'Wide-Stance Leg Press', 'Y-Raise'])

const placements = new Map<string, CanonicalMuscle>()
for (const [muscle, names] of Object.entries(clearPlacements)) {
  for (const name of names) placements.set(name, muscle as CanonicalMuscle)
}

export function getExactWeekdayExerciseMapping(name: string): WeekdayExerciseMapping {
  const muscle = placements.get(name)
  if (muscle) return { kind: 'movable', primaryMuscles: [muscle], basis: `${WEEKDAY_EXERCISE_MAPPING_VERSION}: ${name}${name === 'Smith Machine Press' ? '; existing exerciseVariants shoulder_press exact alias' : ''}` }
  if (nonStrength.has(name)) return { kind: 'pinned', category: 'non_strength',
    reason: `${name} is a saved activity or recovery entry, rather than a strength-muscle prescription.`,
    ownerDecision: 'Keep this activity on its prescribed weekday; changing its schedule is not part of muscle-group redistribution.' }
  if (unspecifiedBlocks.has(name)) return { kind: 'pinned', category: 'ambiguous',
    reason: `${name} does not identify its individual exercises or their primary placement.`,
    ownerDecision: `The program owner needs to define the existing contents and intended placement of ${name} before it can move. Do not split or replace this block.` }
  if (ambiguousIdentities.has(name)) return { kind: 'pinned', category: 'ambiguous',
    reason: `${name}'s intended primary placement is not established by the saved source.`,
    ownerDecision: `The program owner needs to confirm the intended muscle-group placement of ${name}. Its prescribed weekday and dose remain unchanged.` }
  return { kind: 'pinned', category: 'unknown', reason: `${name} has no reviewed exact identity in this mapping version.`,
    ownerDecision: 'The program owner needs to review this exact identity before it can be redistributed; retain the original prescription.' }
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, index) => equal(value, b[index]))
  if (!record(a) || !record(b)) return false
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && equal(a[key], b[key]))
}

const generatedExerciseKeys = new Set(['display_name', 'movement_pattern', 'selected_variant_id', 'selected_variant_name',
  'selected_equipment', 'load_type', 'available_variants', 'assessment_key', 'estimated_1rm', 'intensity_factor',
  'rep_multiplier', 'baseline_weight', 'calculated_weight', 'recommended_weight', 'calculation_note'])
const identityKeys = ['display_name', 'movement_pattern', 'selected_variant_id', 'selected_variant_name',
  'selected_equipment', 'load_type', 'available_variants', 'calculated_weight', 'calculation_note']
const unloadedFallbacks = new Set(['side plank', 'single-leg glute bridge', 'walking lunge', 'reverse lunge', 'sumo squat', 'bulgarian split squat'])
const normalizeGeneratorAlias = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ')

/** Verify identity, not personalized formula results; all saved dose/load fields stay untouched. */
function generatedIdentityMatches(saved: Record<string, unknown>, originalName: string): boolean {
  if (!Object.keys(saved).some(key => generatedExerciseKeys.has(key))) return true
  if (identityKeys.some(key => !Object.hasOwn(saved, key))) return false
  const group = exerciseVariants.find(source => source.aliases.some(alias => normalizeGeneratorAlias(alias) === normalizeGeneratorAlias(originalName)))
  if (!Array.isArray(saved.available_variants) || typeof saved.calculation_note !== 'string') return false
  for (const key of ['estimated_1rm', 'intensity_factor', 'rep_multiplier', 'baseline_weight', 'calculated_weight', 'recommended_weight']) {
    if (Object.hasOwn(saved, key) && saved[key] !== null && (typeof saved[key] !== 'number' || !Number.isFinite(saved[key]))) return false
  }
  if (group) {
    const variant = group.variants.find(source => source.id === saved.selected_variant_id)
    if (!variant || saved.display_name !== group.display_name || saved.movement_pattern !== group.pattern ||
      saved.selected_variant_name !== variant.name || saved.selected_equipment !== variant.equipment || saved.load_type !== variant.load_type) return false
    if (Object.hasOwn(saved, 'assessment_key') && saved.assessment_key !== group.assessment_key) return false
    const ids = new Set<string>()
    for (const available of saved.available_variants) {
      if (!record(available) || typeof available.id !== 'string' || ids.has(available.id) || !group.variants.some(source => equal(source, available))) return false
      ids.add(available.id)
    }
    return ids.has(variant.id)
  }
  const unloaded = unloadedFallbacks.has(normalizeGeneratorAlias(originalName))
  return saved.display_name === originalName && saved.movement_pattern === null && saved.selected_variant_id === null &&
    saved.selected_variant_name === originalName && (saved.selected_equipment === null || unloaded && saved.selected_equipment === 'bodyweight') &&
    saved.load_type === (unloaded ? 'bodyweight' : 'total_load') && saved.available_variants.length === 0
}

export function hasVersionedTemplateClaim(programJson: unknown): boolean {
  return record(programJson) && (Object.hasOwn(programJson, 'template_program') || Object.hasOwn(programJson, 'template_version'))
}

/** Strict, read-only adapter for current exact source templates, never a plan migration. */
export function resolveVersionedWeekdayExerciseMappings({ programJson, outputProgram }: {
  programJson: unknown
  outputProgram?: unknown
}): VersionedWeekdayExerciseMappings {
  const fail = (code: string, message: string, day?: string, exercise?: string): VersionedWeekdayExerciseMappings => ({
    status: 'unsupported', issues: [{ code, message: `${message} Your current plan has been kept.`, ...(day ? { day } : {}), ...(exercise ? { exercise } : {}) }],
  })
  if (!record(programJson) || typeof programJson.template_program !== 'string' || typeof programJson.template_version !== 'string') {
    return fail('unverified_template_provenance', 'A saved source template and version are required before redistributing this plan.')
  }
  const source = Object.hasOwn(sources, programJson.template_program) ? sources[programJson.template_program] : undefined
  if (!source || source.template.version !== programJson.template_version || createHash('sha256').update(JSON.stringify(source.template)).digest('hex') !== source.contentSha256) {
    return fail('unsupported_template_version', 'This saved source template/version has no matching reviewed placement map.')
  }
  const sourceProgram = source.template.program
  const permittedPrograms = sourceProgram.startsWith('phoenix') ? [sourceProgram, 'phoenix'] : [sourceProgram]
  if (typeof programJson.program !== 'string' || !permittedPrograms.includes(programJson.program) ||
    outputProgram !== undefined && (typeof outputProgram !== 'string' || !permittedPrograms.includes(outputProgram)) ||
    Object.hasOwn(programJson, 'phoenix_track') && programJson.phoenix_track !== sourceProgram) {
    return fail('template_program_mismatch', 'The saved program or track does not match its stated source template.')
  }
  if (programJson.equipment_review_required === true || Object.hasOwn(programJson, 'excluded_exercises') &&
    (!Array.isArray(programJson.excluded_exercises) || programJson.excluded_exercises.length !== 0)) {
    return fail('template_equipment_exclusions', 'This saved plan has equipment exclusions that prevent an exact prescribed-week match.')
  }
  if (!Array.isArray(programJson.days) || programJson.days.length !== source.template.days.length) {
    return fail('template_week_mismatch', 'The saved weekdays do not exactly match the reviewed source week.')
  }
  const occurrences: Extract<VersionedWeekdayExerciseMappings, { status: 'compatible' }>['occurrences'] = []
  const present = new Set<string>()
  for (let dayIndex = 0; dayIndex < source.template.days.length; dayIndex += 1) {
    const original = source.template.days[dayIndex]
    const saved = programJson.days[dayIndex]
    if (!record(saved) || !equal(Object.fromEntries(Object.entries(saved).filter(([key]) => key !== 'exercises')),
      Object.fromEntries(Object.entries(original).filter(([key]) => key !== 'exercises'))) ||
      !Array.isArray(saved.exercises) || saved.exercises.length !== original.exercises.length) {
      return fail('template_day_mismatch', 'A saved weekday, intent, order, focus or exercise count differs from the reviewed source.', original.day_name)
    }
    present.add(original.day_name)
    for (let index = 0; index < original.exercises.length; index += 1) {
      const prescription = original.exercises[index]
      const exercise = saved.exercises[index]
      const name = String(prescription.exercise)
      if (!record(exercise) || Object.keys(prescription).some(key => !Object.hasOwn(exercise, key) || !equal(exercise[key], prescription[key])) ||
        Object.keys(exercise).some(key => !Object.hasOwn(prescription, key) && !generatedExerciseKeys.has(key))) {
        return fail('template_prescription_mismatch', 'A saved exercise identity, order, dose or unsupported field differs from the reviewed source.', original.day_name, name)
      }
      if (!generatedIdentityMatches(exercise, name)) return fail('template_variant_mismatch', 'A saved variant, equipment or generated identity cannot be verified against its source exercise.', original.day_name, name)
      occurrences.push({ day: original.day_name as Weekday, index, exercise, mapping: getExactWeekdayExerciseMapping(name) })
    }
  }
  return { status: 'compatible', provenance: { templateProgram: sourceProgram, templateVersion: source.template.version,
    mappingVersion: WEEKDAY_EXERCISE_MAPPING_VERSION, sourceTemplateContentSha256: source.contentSha256 },
  occurrences, missingWeekdays: WEEKDAYS.filter(day => !present.has(day)) }
}
