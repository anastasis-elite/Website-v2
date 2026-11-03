import assert from 'node:assert/strict'
import test, { after, mock } from 'node:test'
import { readFileSync } from 'node:fs'
import { importTs } from './typescriptModule.mjs'
import { client as ownedClient, final, database } from './strengthSchedulingFixture.mjs'

mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-09T13:00:00Z') })
after(() => mock.timers.reset())
const { strengthCadence } = await importTs('lib/assessment/strengthCadence.ts')
const { getStrengthAssessmentStatus } = await importTs('lib/assessment/getStrengthAssessmentStatus.ts')
const { projectStrengthWorkout, strengthCompletionForDay } = await importTs('lib/assessment/strengthWorkout.ts')
const { getClientDayRange } = await importTs('lib/schedule/time.ts')
const { buildTodayViewModel } = await importTs('lib/dashboard/buildTodayViewModel.ts')
const { memberAssessmentStatusFromRecords } = await importTs('lib/assessment/getMonthlyAssessmentStatus.ts')
const { runFlameExecutionEngine } = await importTs('lib/dashboard/logic/engines.ts')
const { strengthCalendarEvents } = await importTs('lib/assessment/strengthCalendar.ts')
const { getDailyScheduleState } = await importTs('lib/schedule/service.ts', {
  '@/lib/calendar/service': 'export const importedScheduleEvents = async () => []',
  '@/lib/day/getDailyExecutionPlan': 'export const getDailyExecutionPlan = async () => null',
  '@/lib/dashboard/logic/getProgramLogicForClient': 'export const getProgramLogicForClient = async () => null',
})
const client = { ...ownedClient, wake_time:'05:00', bed_time:'21:00', preferred_workout_time:'10:00', current_workout_minutes_per_session:30,
  work_start_time:'09:00', work_end_time:'17:00', work_days_of_week:[1], timezone:'Etc/UTC', onboarding_data:{} }
const date = '2026-11-09'
function logic(strength) { return { program:'ember', generatedAt:new Date().toISOString(), client:{id:client.client_id,timezone:client.timezone},
  assessments:{dailyCompleted:true,strength}, symptoms:{redFlag:false}, capacityStatus:{status:'high_capacity'}, recoveryStatus:{reasoning:'Existing recovery guidance.'},
  recoveryCheck:{energy:5,stress:2,soreness:1},sleep:{hours:8,quality:4},
  hydration:{status:'ready',target:80,consumed:80,remaining:0,percent:100,presentationPacing:{state:'complete'}},
  nutrition:{dataStatus:'known',calories:{percent:100},protein:{percent:100},pacing:{state:'complete'}},
  execution:{workoutComplete:Boolean(strength.completedToday),nutritionLogged:true,recoveryComplete:false},
  workout:{assigned:true,title:'Saved regular workout'},workoutDecision:{canTrain:true,assignedWorkout:{workout_state:'training',exercises:[{name:'Squat'}]},adjustmentLevel:'level_0_full_plan',reasonForModification:'Existing saved decision.'} } }
async function scheduled({ strength, member = client, persisted = [], unavailableSources = [] } = {}) {
  const reader = {}, day = getClientDayRange(member, date), currentLogic = logic(strength)
  return getDailyScheduleState({ supabase:reader,user:{id:client.auth_user_id},client:member,date,logic:currentLogic,
    dailyPlan:{date,timezone:member.timezone,timing:{workoutTime:member.preferred_workout_time}},
    sources:{reader,userId:client.auth_user_id,clientId:client.client_id,day,persistedEvents:persisted,calendarEvents:[],blocks:[],checkoffs:[],unavailableSources} })
}
async function dueStatus() { return getStrengthAssessmentStatus(database({assessments:[final('2026-08-09T12:00:00Z')]}), client) }

test('three calendar months clamp month ends/leap days and the following Monday is inclusive', () => {
  for (const [stamp,eligible,monday] of [
    ['2026-08-31T12:00:00Z','2026-11-30','2026-11-30'],
    ['2023-11-30T12:00:00Z','2024-02-29','2024-03-04'],
    ['2024-02-29T12:00:00Z','2024-05-29','2024-06-03'],
    ['2026-08-09T12:00:00Z','2026-11-09','2026-11-09'],
  ]) {
    const status = strengthCadence(client,stamp,new Date('2026-11-09T13:00:00Z'))
    assert.equal(status.eligibleDate,eligible); assert.equal(status.scheduledDate,monday)
  }
  const before = strengthCadence(client,'2026-08-09T12:00:00Z',new Date('2026-11-08T23:59:59Z'))
  assert.equal(before.eligible,false); assert.equal(before.isWorkoutDay,false)
  const at = strengthCadence(client,'2026-08-09T12:00:00Z',new Date('2026-11-09T00:00:00Z'))
  assert.equal(at.eligible,true); assert.equal(at.isWorkoutDay,true)
})

test('Monday work commitments use existing flexible workout conflict suggestions, never invented work hours or automatic moves', async () => {
  const strength = await dueStatus(), state = await scheduled({strength})
  const work = state.events.find(event => event.event_type === 'work'), assessment = state.events.find(event => event.title === 'Strength assessment')
  assert.equal(work.start_at,'2026-11-09T09:00:00.000Z'); assert.equal(work.end_at,'2026-11-09T17:00:00.000Z')
  assert.equal(assessment.event_type,'workout'); assert.equal(assessment.start_at,'2026-11-09T10:00:00.000Z')
  assert.equal(assessment.action_route,strength.href); assert.equal(state.events.filter(event => event.event_type === 'workout').length,1)
  const adjustment = state.adjustments.find(item => item.event_id === assessment.id && item.adjustment_type === 'suggest_move')
  assert.match(adjustment.reason,/commitment|transition/); assert.equal(adjustment.applied,false)
  assert.ok(Date.parse(adjustment.suggested_start_at) >= Date.parse('2026-11-09T17:10:00Z'))
  assert.equal(state.dailyRecommendation.primary.eventId,work.id)
  assert.equal(state.events.filter(event => event.event_type === 'assessment' && event.title !== 'Strength assessment').length,1,'Existing monthly structure review remains present')
})

test('Today card and next step agree on the assessment workout and retain saved skips/deferrals', async () => {
  const strength = await dueStatus(), member = { ...client,work_start_time:null,work_end_time:null,daily_structure_reviewed_at:'2026-11-01T12:00:00Z' }
  const state = await scheduled({strength,member})
  assert.equal(state.todayViewModel.today.activities.find(item => item.id === 'workout').title,'Strength assessment')
  assert.equal(state.todayViewModel.workout.state,'assessment');assert.equal(state.todayViewModel.workout.inactive,false)
  assert.equal(state.todayViewModel.workout.title,'Strength assessment');assert.equal(state.dailyRecommendation.training.label,'Strength assessment')
  assert.equal(state.dailyRecommendation.primary.title,'Strength assessment'); assert.equal(state.dailyRecommendation.primary.href,strength.href)
  const safetyLogic=logic(strength)
  safetyLogic.workoutDecision.canTrain=false;safetyLogic.workoutDecision.assignedWorkout.workout_state='rest'
  const safetyModel=buildTodayViewModel(safetyLogic,state)
  assert.equal(safetyModel.workout.state,'assessment');assert.equal(safetyModel.workout.inactive,false)
  assert.equal(safetyModel.recommendation.primary.id,'workout','An otherwise safe ordinary rest day does not suppress the assessment')
  for (const intent of [{status:'skipped'},{status:'deferred',until:'2026-11-09T20:00:00Z'}]) {
    const held = await scheduled({strength,member:{...member,onboarding_data:{dailyGuide:{date,activities:{workout:intent}}}}})
    assert.notEqual(held.dailyRecommendation.primary.id,'workout')
    assert.equal(held.todayViewModel.today.activities.find(item => item.id === 'workout').status,intent.status)
  }
  const unknown = await scheduled({strength,member,unavailableSources:['calendar']})
  assert.deepEqual(unknown.openWindows,[]); assert.deepEqual(unknown.adjustments,[])
})

test('no saved workout time gives an untimed assessment; accepted scheduling choices and external events stay intact', async () => {
  const strength = await dueStatus(), member = {...client,preferred_workout_time:null}, state = await scheduled({strength,member})
  const event = state.events.find(item => item.title === 'Strength assessment')
  assert.equal(event.all_day,true); assert.equal(event.estimated_duration_minutes,null); assert.equal(event.movable,false)
  const original = {...event,id:'saved-workout',source:'anastasis',all_day:false,status:'deferred',start_at:'2026-11-09T10:00:00Z',end_at:'2026-11-09T10:30:00Z',adjusted_start_at:'2026-11-09T19:00:00Z',adjusted_end_at:'2026-11-09T19:30:00Z'}
  const external = {...original,id:'external',calendar_event_id:'provider',source:'external_calendar'}
  const cancelled = {...original,id:'cancelled',title:'Cancelled regular workout',status:'cancelled'}
  const projected = projectStrengthWorkout({status:strength,userId:client.auth_user_id,client,date,events:[original,external,cancelled]})
  assert.equal(projected.find(item=>item.id==='saved-workout').adjusted_start_at,original.adjusted_start_at)
  assert.equal(projected.find(item=>item.id==='saved-workout').status,'deferred')
  assert.deepEqual(projected.find(item=>item.id==='external'),external)
  assert.deepEqual(projected.find(item=>item.id==='cancelled'),cancelled)
})

test('only a dated published final completes the assessment workout; no next workout or extra streak work is fabricated', async () => {
  const timestamp = '2026-11-09T12:30:00Z'
  const strength = await getStrengthAssessmentStatus(database({assessments:[final(timestamp,{id:'completed-strength'})]}),client)
  assert.equal(strengthCompletionForDay(strength,client,date),true)
  assert.equal(strengthCompletionForDay(strength,client,'2026-11-08'),false)
  assert.equal(strengthCompletionForDay({...strength,latestCompletedAt:'2026-11-09T23:30:00Z'},client,date),false)
  const state = await scheduled({strength})
  assert.equal(state.events.find(event => event.title === 'Strength assessment').status,'completed')
  const regular={...state.events.find(event=>event.title==='Strength assessment'),id:'saved-regular',title:'Regular workout',status:'scheduled',completed_at:null,source:'anastasis',virtual:false}
  const withSaved=await scheduled({strength,persisted:[regular]})
  assert.equal(withSaved.events.filter(event=>event.event_type==='workout').length,1)
  assert.equal(withSaved.events.find(event=>event.id==='saved-regular').title,'Strength assessment')
  assert.equal(withSaved.events.find(event=>event.id==='saved-regular').completed_at,timestamp)
  assert.ok(!state.todayViewModel.presentedActivities.some(item => item.id === 'workout'))
  assert.notEqual(state.dailyRecommendation.primary.category,'workout')
  const inputs={date,program:'ember',client,dailyPlan:{workoutCompleted:strengthCompletionForDay(strength,client,date)},todayRecovery:{check_in_completed_at:timestamp},todayRecoveryActivities:[],phoenixTaskIds:[],missedDayCount:0,executionHistory:[]}
  const flame=runFlameExecutionEngine({inputs,hydration:{percent:100},nutrition:{dataStatus:'known'},capacity:{status:'high_capacity'},workoutDecision:{assignedWorkout:{workout_state:'training'}}})
  assert.equal(flame.requirements.completedItems.workoutOrMovement,true); assert.equal(flame.streakEligible,true)
  const engine = readFileSync('lib/dashboard/logic/getProgramLogicEngine.ts','utf8')
  assert.match(engine,/strengthCompletionForDay\(inputs\.strengthAssessment, inputs\.client, inputs\.date\)/)
  assert.match(engine,/completedWorkoutTitle: 'Strength assessment'/)
})

test('monthly member reviews retain their established one-month/quarterly dates', () => {
  const monthly = memberAssessmentStatusFromRecords({client,full:{submitted_at:'2026-09-30T12:00:00Z'},review:{submitted_at:'2026-10-02T12:00:00Z'},now:new Date('2026-11-09T13:00:00Z')})
  assert.equal(monthly.nextReviewDueDate,'2026-11-02'); assert.equal(monthly.nextFullDueDate,'2026-12-30'); assert.equal(monthly.dueKind,'review')
})

test('calendar projects the same read-only strength date/route; unknown membership/owner and unrelated ranges do not gain events', async () => {
  const db=database({assessments:[final('2026-08-09T12:00:00Z')]})
  const args={supabase:db,user:{id:client.auth_user_id},client,start:'2026-11-09T00:00:00Z',end:'2026-11-10T00:00:00Z'}
  const events=await strengthCalendarEvents(args)
  assert.equal(events.length,1); assert.equal(events[0].title,'Strength assessment'); assert.equal(events[0].event_type,'workout')
  assert.equal(events[0].writable,false); assert.match(events[0].action_route,/assessment\/start2/)
  assert.deepEqual(await strengthCalendarEvents({...args,start:'2026-11-10T00:00:00Z',end:'2026-11-11T00:00:00Z'}),[])
  assert.deepEqual(await strengthCalendarEvents({...args,user:{id:'other'}}),[])
  assert.deepEqual(await strengthCalendarEvents({...args,client:{...client,program:'tracker'}}),[])
  db.verify()
})

test('workout page uses the same dated status instead of cycle windows; the draft/navigation machinery remains in place', () => {
  const page=readFileSync('app/dashboard/program/[program]/workout/page.tsx','utf8')
  assert.doesNotMatch(page,/getAssessmentWindow|strengthWindowStart|strengthWindowEnd/)
  assert.match(page,/isStrengthWorkout\(logic\.assessments\.strength/)
  assert.match(page,/!scheduledStrength\s*&&/)
  assert.match(page,/strengthAssessmentWorkout=\{strengthWorkout\}/)
  const content=readFileSync('app/dashboard/assessment/start2/Start2Content.tsx','utf8')
  assert.match(content,/useUnsavedAssessmentGuard\(session\)/); assert.match(content,/useStrengthDraftAutosave/)
  assert.match(content,/disabled=\{disabled \|\| state\.conflict \|\| !state\.canComplete\}/)
})

test('calendar range projection preserves unrelated dates/owners and saved moves while future assessment links use their future storage period',async()=>{
  const status=await dueStatus()
  const current=projectStrengthWorkout({status,userId:client.auth_user_id,client,date,events:[]})[0]
  const moved={...current,id:'moved',title:'Regular workout',virtual:false,source:'anastasis',adjusted_start_at:'2026-11-09T19:00:00Z',adjusted_end_at:'2026-11-09T19:30:00Z'}
  const nextDay={...current,id:'tomorrow',title:'Tuesday workout',start_at:'2026-11-10T10:00:00Z',end_at:'2026-11-10T10:30:00Z'}
  const foreign={...current,id:'foreign',title:'Other client workout',client_id:'other-client'}
  const args={supabase:database({assessments:[final('2026-08-09T12:00:00Z')]}),user:{id:client.auth_user_id},client,start:'2026-11-09T00:00:00Z',end:'2026-11-11T00:00:00Z',events:[moved,nextDay,foreign]}
  const events=await strengthCalendarEvents(args)
  assert.deepEqual(events.find(event=>event.id==='tomorrow'),nextDay)
  assert.deepEqual(events.find(event=>event.id==='foreign'),foreign)
  assert.equal(events.find(event=>event.id==='moved').title,'Strength assessment')
  assert.equal(events.find(event=>event.id==='moved').adjusted_start_at,moved.adjusted_start_at)
  const future=await strengthCalendarEvents({...args,supabase:database({assessments:[final('2026-11-09T12:30:00Z',{id:'saved-final'})]}),start:'2027-02-15T00:00:00Z',end:'2027-02-16T00:00:00Z',events:[]})
  assert.equal(future.length,1);assert.equal(future[0].action_route,'/dashboard/assessment/start2?period=2027-02-01')
  assert.equal(future[0].status,'scheduled');assert.equal(future[0].completed_at,null)
})
