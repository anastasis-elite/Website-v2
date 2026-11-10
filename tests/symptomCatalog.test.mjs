import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { importTs } from './typescriptModule.mjs'

const { filterAreaSymptoms, periodRelatedSymptoms, resolveSymptomBodyRegion } = await importTs('lib/symptoms/symptomCatalog.ts')
const liveNames = ['Brain Fog', 'Bloating', 'Constipation', 'Diarrhea', 'Gas', 'Nausea', 'Reflux', 'Fatigue', 'Congestion', 'Flushing', 'Itching', 'Joint Pain', 'Muscle Pain', 'Water Retention', 'Cravings', 'Rapid Heart Rate', 'Shakiness', 'Anxiety', 'Irritability', 'Low Mood', 'Dizziness', 'Headache']
const addedNames = ['Menstrual Cramps', 'Pelvic Pain', 'Breast Tenderness', 'Lower Back Pain']
const options = names => names.map((name, index) => ({ id: `catalog-${index}`, name, category: null }))
const catalog = options([...liveNames, ...addedNames])
const regions = ['Head', 'Throat', 'Chest / Heart', 'Stomach / Gut', 'Pelvis / Cycle', 'Back', 'Neck / Shoulders', 'Armpit / Lymph', 'Joints', 'Skin', 'Whole Body'].map((name, index) => ({ id: `region-${index}`, name }))
const names = entries => entries.map(entry => entry.name)

test('period browsing reuses only real catalog records and includes general symptoms without requiring a body area', () => {
  const existing = options(liveNames)
  const matches = periodRelatedSymptoms(existing)
  for (const name of ['Fatigue', 'Water Retention', 'Cravings', 'Anxiety', 'Irritability', 'Low Mood', 'Brain Fog', 'Bloating', 'Headache']) assert.ok(names(matches).includes(name))
  for (const item of matches) assert.ok(existing.includes(item))
  assert.equal(new Set(matches.map(item => item.id)).size, matches.length)
  assert.ok(!names(matches).some(name => addedNames.includes(name)), 'missing migration entries are never fabricated by the client')
  for (const name of addedNames) assert.ok(names(periodRelatedSymptoms(catalog)).includes(name))
})

test('area choices stay anatomical and period context prioritizes the matching additions', () => {
  const expected = {
    head: ['Brain Fog', 'Congestion', 'Dizziness', 'Headache'],
    chest: ['Rapid Heart Rate', 'Breast Tenderness'],
    abdomen: ['Bloating', 'Constipation', 'Diarrhea', 'Gas', 'Nausea', 'Reflux'],
    pelvis: ['Menstrual Cramps', 'Pelvic Pain'],
    arms: ['Joint Pain', 'Muscle Pain'], legs: ['Joint Pain', 'Muscle Pain'],
    back: ['Muscle Pain', 'Lower Back Pain'],
  }
  for (const [area, selected] of Object.entries(expected)) {
    assert.deepEqual(names(filterAreaSymptoms(catalog, area)), selected)
    assert.deepEqual(new Set(names(filterAreaSymptoms(catalog, area, true))), new Set(selected))
    if (area !== 'head') assert.ok(!names(filterAreaSymptoms(catalog, area, true)).includes('Headache'))
  }
  assert.equal(filterAreaSymptoms(catalog, 'chest', true)[0].name, 'Breast Tenderness')
  assert.equal(filterAreaSymptoms(catalog, 'back', true)[0].name, 'Lower Back Pain')
  assert.deepEqual(filterAreaSymptoms(options(liveNames), 'pelvis'), [], 'an empty anatomical list does not fall back to the entire catalog')
})

test('period/general routes resolve anatomical catalog regions only and leave general symptoms unassigned', () => {
  for (const route of ['period', 'all']) {
    for (const [name, region] of [['Menstrual Cramps', 'Pelvis / Cycle'], ['Pelvic Pain', 'Pelvis / Cycle'], ['Breast Tenderness', 'Chest / Heart'], ['Lower Back Pain', 'Back'], ['Headache', 'Head'], ['Bloating', 'Stomach / Gut'], ['Joint Pain', 'Joints']]) {
      assert.equal(resolveSymptomBodyRegion(regions, route, catalog.find(item => item.name === name)), regions.find(item => item.name === region).id)
    }
    for (const name of ['Fatigue', 'Water Retention', 'Cravings', 'Anxiety', 'Irritability', 'Low Mood', 'Brain Fog', 'Dizziness', 'Muscle Pain']) assert.equal(resolveSymptomBodyRegion(regions, route, catalog.find(item => item.name === name)), null)
  }
  assert.equal(resolveSymptomBodyRegion(regions, 'abdomen', null), regions.find(item => item.name === 'Stomach / Gut').id)
  assert.equal(resolveSymptomBodyRegion(regions, 'pelvis', null), regions.find(item => item.name === 'Pelvis / Cycle').id)
  assert.equal(resolveSymptomBodyRegion(regions, 'arms', null), null)
  assert.equal(resolveSymptomBodyRegion(regions, 'legs', null), null)
  assert.equal(resolveSymptomBodyRegion([], 'period', catalog.at(-1)), null)
})

const migration = readFileSync('supabase/migrations/20261110145904_period_symptom_catalog.sql', 'utf8')
const createCatalog = async db => db.exec(`create table public.symptom_types (id uuid default gen_random_uuid() not null, name text not null, category text, severity_scale boolean default true, created_at timestamptz default now());`)

test('additive migration adds exactly four missing concepts with database IDs and preserves all 22 existing rows on replay', async t => {
  const db = new PGlite(); t.after(() => db.close())
  await createCatalog(db)
  for (const name of liveNames) await db.query('insert into symptom_types(name) values ($1)', [name])
  const before = (await db.query('select * from symptom_types order by name')).rows
  await db.exec(migration)
  const first = (await db.query('select * from symptom_types order by name')).rows
  assert.equal(first.length, 26)
  for (const row of before) assert.deepEqual(first.find(item => item.id === row.id), row)
  for (const name of addedNames) {
    const row = first.find(item => item.name === name)
    assert.match(row.id, /^[0-9a-f-]{36}$/)
    assert.equal(row.severity_scale, true)
    assert.equal(row.category, null)
    assert.ok(row.created_at)
  }
  await db.exec(migration)
  assert.deepEqual((await db.query('select * from symptom_types order by name')).rows, first)
})

test('migration retains preexisting case/spacing/hyphen variants rather than duplicating or rewriting their IDs', async t => {
  const db = new PGlite(); t.after(() => db.close())
  await createCatalog(db)
  for (const name of ['  menstrual cramps  ', 'LOWER-BACK PAIN', ' breast  tenderness ']) await db.query('insert into symptom_types(name, category, severity_scale) values ($1, $2, false)', [name, 'existing'])
  const before = (await db.query('select * from symptom_types order by name')).rows
  await db.exec(migration); await db.exec(migration)
  const after = (await db.query('select * from symptom_types order by name')).rows
  assert.equal(after.length, 4)
  for (const row of before) assert.deepEqual(after.find(item => item.id === row.id), row)
  assert.equal(after.filter(row => row.name === 'Pelvic Pain').length, 1)
})
