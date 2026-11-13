import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'
const { roundSuggestedWeightLb: round, weightInputIncrement: increment } = await importTs('lib/workout/weightRounding.ts')
const { activityDose } = await importTs('lib/workout/activity.ts')
const { actualWeightForInput, exerciseLoadPresentation } = await importTs('lib/workout/exerciseLoadPresentation.ts')
const db = { selected_equipment: 'dumbbell', load_type: 'per_hand' }
test('per-hand dumbbell boundary and nearest grid are explicit', () => {
  for (const [raw, expected] of [[1,0],[1.25,2.5],[4,5],[11,10],[12,12.5],[14,15],[15,15],[15.01,15],[17.49,15],[17.5,20],[28,30]]) assert.equal(round(db,raw),expected)
  assert.equal(increment(db,15),2.5)
  assert.equal(increment(db,15.1),5)
  assert.equal(round({...db,load_type:'single_side'},12),12.5)
})
test('other equipment and ambiguous total dumbbells use total five without halving or assumed bar mass', () => {
  for (const selected_equipment of ['barbell','machine','cable','smith','band','unknown']) {
    assert.equal(round({selected_equipment},12),10)
    assert.equal(round({selected_equipment},17.5),20)
    assert.equal(round({selected_equipment},2.5),5)
  }
  assert.equal(round({...db,load_type:'total_load'},12),10)
  assert.equal(round({selected_equipment:'dumbbell'},27),25)
  const selected = {...db,selected_variant_id:'cable', available_variants:[{id:'cable',equipment:'cable',load_type:'total_load'}]}
  assert.equal(round(selected,12),10)
})
test('invalid and sub-increment loads never become invented positive recommendations', () => {
  for (const value of [NaN,Infinity,-5,0]) assert.equal(round(db,value),0)
  assert.equal(round({selected_equipment:'barbell'},2),0)
  assert.equal(exerciseLoadPresentation({recommended_weight:0},{source:'manual'}).recommendationAvailable,false)
})
test('kg is converted from the pound suggestion; controls follow equipment rather than kg cutoffs', () => {
  const exercise={...db,recommended_weight:12.5,weight_unit:'lb'}
  assert.equal(activityDose(exercise,'kg').weight,5.7)
  assert.equal(increment(db,5.7,'kg'),1.1)
  assert.equal(increment(db,9.1,'kg'),2.3)
  assert.equal(activityDose({...exercise,weight_unit:'kg',recommended_weight:10},'lb').weight,22)
})
test('recorded and explicitly typed weights are never snapped to the recommendation grid', () => {
  const exercise={...db,recommended_weight:30,set_logs:[{weight:28.3,weight_unit:'lb'}]}
  assert.equal(actualWeightForInput(exercise,'lb',{source:'manual'}),28.3)
  assert.equal(actualWeightForInput(exercise,'lb',{source:'manual'},17.3,true),17.3)
  assert.equal(activityDose({...db,recommended_weight:28},'lb').weight,28) // retained legacy snapshot
})
