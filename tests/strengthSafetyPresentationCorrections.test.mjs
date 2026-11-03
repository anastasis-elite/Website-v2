import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { importTs } from './typescriptModule.mjs'
const { buildTodayViewModel }=await importTs('lib/dashboard/buildTodayViewModel.ts')
const { strengthTrainingPaused }=await importTs('lib/assessment/strengthWorkoutState.ts')
const date='2026-11-09'
function fixture() {
  const strength={state:'due',label:'Due',period:'2026-11-01',completedAt:null,savedAt:null,assessmentId:null,previousDraft:null,unavailable:false,actionLabel:'Start Assessment',href:'/dashboard/assessment/start2?period=2026-11-01',eligible:true,eligibleDate:date,scheduledDate:date,isWorkoutDay:true,completedToday:false}
  const logic={program:'ember',generatedAt:date+'T13:00:00Z',client:{id:'OWN',timezone:'UTC'},assessments:{dailyCompleted:true,strength},
    symptoms:{redFlag:false},recoveryStatus:{status:'normal_training_day',reasoning:'Existing recovery guidance.'},capacityStatus:{status:'high_capacity'},
    recoveryCheck:{energy:5,stress:2,soreness:1},sleep:{hours:8,quality:4},
    hydration:{status:'ready',target:80,consumed:80,remaining:0,percent:100,presentationPacing:{state:'complete'}},
    nutrition:{dataStatus:'known',calories:{percent:100},protein:{percent:100},pacing:{state:'complete'}},
    execution:{workoutComplete:false,nutritionLogged:true,recoveryComplete:false},workout:{assigned:true,title:'Regular saved workout'},
    workoutDecision:{canTrain:true,assignedWorkout:{workout_state:'training',exercises:[{name:'Squat'}]},adjustmentLevel:'level_0_full_plan',reasonForModification:'Existing saved decision.'}}
  const event={id:'scheduled-strength',event_type:'workout',title:'Strength assessment',status:'scheduled',suggested:false,flexibility_type:'flexible',start_at:date+'T14:00:00Z',end_at:date+'T14:30:00Z',action_route:strength.href}
  const schedule={date,timezone:'UTC',now:date+'T13:00:00Z',events:[event],nextActionableEvent:event,dailyGuide:{date,activities:{schedule:{status:'reviewed'}}}}
  return {logic,schedule}
}

test('genuine safety, recovery-only, and canTrain=false restrictions suppress uncompleted assessment coaching throughout Today',()=>{
  for(const condition of ['redFlag','recoveryStatus','recoveryWorkout','canTrain','level4']) {
    const {logic,schedule}=fixture()
    if(condition==='redFlag')logic.symptoms.redFlag=true
    if(condition==='recoveryStatus')logic.recoveryStatus.status='full_recovery_or_red_flag'
    if(condition==='recoveryWorkout')logic.workoutDecision.assignedWorkout.workout_state='recovery'
    if(condition==='canTrain')logic.workoutDecision.canTrain=false
    if(condition==='level4')logic.workoutDecision.adjustmentLevel='level_4_rest_or_red_flag'
    const original=structuredClone(logic.assessments.strength),model=buildTodayViewModel(logic,schedule)
    assert.equal(strengthTrainingPaused(logic),true,condition)
    assert.equal(model.workout.inactive,true,condition);assert.equal(model.workout.state,'recovery',condition)
    assert.equal(model.workout.title,'Training paused');assert.match(model.workout.reason,/testing is paused/)
    assert.equal(model.recommendation.training.mode,'recovery_only')
    assert.equal(model.recommendation.training.label,'Recovery-only day')
    assert.equal(model.recommendation.primary.id,'safety')
    assert.ok(!model.presentedActivities.some(activity=>activity.id==='workout'||activity.id==='assessment:strength'))
    assert.ok(![model.recommendation.primary,...model.recommendation.supporting].some(action=>action.category==='workout'))
    assert.deepEqual(logic.assessments.strength,original,'Due date, draft/history access and completion evidence remain unchanged')
  }
})

test('otherwise safe ordinary rest and unavailable regular-plan states still allow the scheduled assessment workout',()=>{
  for(const state of ['training','rest','unavailable']) {
    const {logic,schedule}=fixture()
    logic.workoutDecision.assignedWorkout.workout_state=state;logic.workoutDecision.canTrain=state==='training';logic.workout.assigned=state==='training'
    const model=buildTodayViewModel(logic,schedule)
    assert.equal(strengthTrainingPaused(logic),false,state)
    assert.equal(model.workout.inactive,false);assert.equal(model.workout.state,'assessment')
    assert.equal(model.recommendation.training.label,'Strength assessment')
    assert.equal(model.presentedActivities.find(activity=>activity.id==='workout').title,'Strength assessment')
    assert.equal(model.recommendation.primary.title,'Strength assessment');assert.equal(model.recommendation.primary.href,logic.assessments.strength.href)
  }
})

test('a later safety pause retains already-completed assessment credit and historical destination while stopping new training advice',()=>{
  const {logic,schedule}=fixture()
  Object.assign(logic.assessments.strength,{state:'completed',label:'Completed',completedToday:true,completedDate:date,latestCompletedAt:date+'T12:00:00Z',completedAt:date+'T12:00:00Z',actionLabel:'View Saved Results',href:'/dashboard/assessment/start2?period=2026-11-01&assessmentId=original'})
  logic.execution.workoutComplete=true;logic.symptoms.redFlag=true;schedule.events[0].status='completed'
  const model=buildTodayViewModel(logic,schedule)
  assert.equal(model.today.activities.find(activity=>activity.id==='workout').status,'completed')
  assert.ok(!model.presentedActivities.some(activity=>activity.id==='workout'))
  assert.equal(model.recommendation.evidence.workout,'completed');assert.equal(model.recommendation.primary.id,'safety')
  assert.equal(model.workout.inactive,true);assert.equal(logic.assessments.strength.completedAt,date+'T12:00:00Z')
  assert.match(logic.assessments.strength.href,/assessmentId=original/)
})

test('server workout-page presentation uses the same pause decision plus actual safety flags without changing manual logging or cadence',()=>{
  const page=readFileSync('app/dashboard/program/[program]/workout/page.tsx','utf8')
  assert.match(page,/strengthTrainingPaused\(logic, hasSafetyFlags\)/)
  assert.match(page,/const strengthWorkout = scheduledStrength && \(!strengthPaused \|\| logic\.assessments\.strength\.completedToday\)/)
  assert.match(page,/!scheduledStrength\s*&&/)
  assert.match(page,/strengthAssessmentWorkout=\{strengthWorkout\}/)
  const {logic}=fixture();assert.equal(strengthTrainingPaused(logic,true),true)
})
