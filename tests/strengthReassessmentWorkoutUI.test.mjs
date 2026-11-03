import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { importTs } from './typescriptModule.mjs'
const require=createRequire(import.meta.url)
const status=await importTs('lib/assessment/getStrengthAssessmentStatus.ts')
const activity=await importTs('lib/workout/activity.ts')
const logging=await importTs('lib/workout/logging.ts')
const prefs=await importTs('lib/workout/viewPreferences.ts')
const strengthState=await importTs('lib/assessment/strengthWorkoutState.ts')
let selectedTab='progress',selectedMode='recommended'
const module={exports:{}}
const source=readFileSync('components/workout-dashboard/WorkoutDashboard.tsx','utf8')
const mocks={
  react:{...React,useState:initial=>[initial==='progress'?selectedTab:initial==='recommended'?selectedMode:initial,()=>{}],useEffect:()=>{}},
  'next/link':{__esModule:true,default:'a'},
  '@/lib/assessment/getStrengthAssessmentStatus':status,'@/lib/assessment/strengthWorkoutState':strengthState,'@/lib/workout/activity':activity,'@/lib/workout/logging':logging,'@/lib/workout/viewPreferences':prefs,
  '@/components/WorkoutTracker':{__esModule:true,default:()=>React.createElement('div',{'data-testid':'regular-tracker'})},
  '@/components/workout-dashboard/ManualWorkoutBuilder':{__esModule:true,default:()=>React.createElement('div',{'data-testid':'manual-builder'})},
  '@/components/legal/SafetyEscalationNotice':{__esModule:true,default:()=>React.createElement('div',{'role':'alert'},'Existing safety notice')},
  '@/components/workout-feedback/WorkoutFeedback':{__esModule:true,default:()=>null},
}
runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:name=>mocks[name]||require(name)})

function propsFor() {
  const strength={...status.strengthAssessmentStatusFromRecords({period:'2026-11-01'}),eligible:true,eligibleDate:'2026-11-09',scheduledDate:'2026-11-09',isWorkoutDay:true}
  return {clientId:'OWN',authUserId:'owner',program:'ember',workoutTitle:'Strength assessment',workoutStateLabel:'Strength assessment',assignedWorkoutId:'existing',assignedDayName:'Monday',assignedExercises:[{name:'Squat',sets:4,reps:8}],showInteractiveWorkout:false,hasSafetyFlags:false,safetyFlags:[],strengthAssessmentWorkout:true,workoutHistory:[],muscleReadiness:[],memberEquipment:[],previewTitle:'Training paused',previewMessage:'Review existing recovery guidance.',logic:{assessments:{strength},symptoms:{redFlag:false},recoveryStatus:{status:'normal_training_day'},client:{timezone:'UTC'},execution:{workoutComplete:false},workout:{durationMinutes:30},workoutDecision:{canTrain:true,adjustmentLevel:'level_0_full_plan',assignedWorkout:{workout_state:'training'},reasonForModification:'Existing saved reason'}}}
}
const render=props=>renderToStaticMarkup(React.createElement(module.exports.default,props))

test('safe eligible workout renders the assessment; ordinary rest or an absent regular plan do not suppress it',()=>{
  for(const state of ['training','rest','unavailable']) {
    const props=propsFor();props.logic.workoutDecision.assignedWorkout.workout_state=state
    props.logic.workoutDecision.canTrain=state==='training'
    const html=render(props)
    assert.match(html,/data-testid="strength-assessment-workout"/);assert.match(html,/class="tier-primary-action"/)
    assert.match(html,/href="\/dashboard\/assessment\/start2\?period=2026-11-01"/)
    assert.doesNotMatch(html,/data-testid="regular-tracker"/)
    for(const tab of ['Progress','Strength','Recovery','History'])assert.match(html,new RegExp('>'+tab+'<'))
  }
})

test('safety flags or a real training pause remove the primary assessment while preserving draft/history review and manual policy',()=>{
  for(const patch of ['flags','redFlag','canTrain','recovery']) {
    const props=propsFor()
    props.showInteractiveWorkout=true
    if(patch==='flags')props.hasSafetyFlags=true
    if(patch==='redFlag')props.logic.symptoms.redFlag=true
    if(patch==='canTrain')props.logic.workoutDecision.canTrain=false
    if(patch==='recovery')props.logic.workoutDecision.assignedWorkout.workout_state='recovery'
    let html=render(props)
    assert.doesNotMatch(html,/data-testid="strength-assessment-workout"/)
    assert.doesNotMatch(html,/data-testid="regular-tracker"/)
    assert.match(html,/Training paused/)
    if(patch==='flags')assert.match(html,/Existing safety notice/)
    selectedTab='strength';html=render(props);selectedTab='progress'
    assert.match(html,/Review assessment/);assert.match(html,/saved assessment and draft remain available to review/)
    assert.match(html,/href="\/dashboard\/assessment\/start2\?period=2026-11-01"/)
    selectedMode='manual';html=render(props);selectedMode='recommended'
    assert.match(html,/data-testid="manual-builder"/,'Existing manual logging policy is unchanged')
  }
})

test('completed assessment remains a secondary read-only results link under a later safety pause',()=>{
  const props=propsFor();props.hasSafetyFlags=true
  Object.assign(props.logic.assessments.strength,{state:'completed',completedToday:true,completedAt:'2026-11-09T12:00:00Z',actionLabel:'View Saved Results'})
  const html=render(props)
  assert.match(html,/data-testid="strength-assessment-workout"/);assert.match(html,/View Saved Results/)
  assert.match(html,/class="tier-secondary-action"/);assert.doesNotMatch(html,/class="tier-primary-action"/)
  assert.match(html,/Existing safety notice/)
})
