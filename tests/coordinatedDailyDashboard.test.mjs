import assert from 'node:assert/strict'
import test from 'node:test'
import { importTs } from './typescriptModule.mjs'
const time = await importTs('lib/timezone.ts')
const scheduleTime = await importTs('lib/schedule/time.ts')
const calendar = await importTs('lib/calendar/view.ts')
const { buildDailyRecommendation } = await importTs('lib/dashboard/dailyRecommendation.ts')
const { buildWhatsNextState } = await importTs('lib/dashboard/whatsNext.ts')
const { getTierCapabilities } = await importTs('lib/entitlements.ts')
const { calculateHydrationPacing } = await importTs('lib/hydration/pacing.ts')
const { activityDose, workoutCompletion, summarizeStrengthSets } = await importTs('lib/workout/activity.ts')
const { getAvailableWindows } = await importTs('lib/schedule/getAvailableWindows.ts')
const { recurringCommitmentsToEvents, dailyPlanToScheduleEvents } = await importTs('lib/schedule/dailyPlanAdapter.ts')
const {getOpenWindows,buildScheduleAdjustments}=await importTs('lib/schedule/engine.ts')
const { scheduleConflict } = await importTs('lib/schedule/actions.ts')
const { mergeDailySymptoms } = await importTs('lib/dashboard/dailySignals.ts')
const {loadScheduleEventsForDay}=await importTs('lib/schedule/service.ts', {
 '@/lib/calendar/service':'export const importedScheduleEvents = async () => []',
 '@/lib/day/getDailyExecutionPlan':'export const getDailyExecutionPlan = async () => null',
 '@/lib/dashboard/logic/getProgramLogicForClient':'export const getProgramLogicForClient = async () => null',
})
const zone = 'America/Chicago'
const fixture = () => ({ program:'ignite', nutrition:{dataStatus:'needs_input',calories:{percent:0},protein:{percent:0}}, hydration:{status:'needs_input',consumed:0,remaining:111}, assessments:{dailyCompleted:false}, execution:{workoutComplete:false,recoveryComplete:false,completedWorkoutTitle:'Strength day'}, workout:{assigned:true,title:'Strength day'}, workoutDecision:{canTrain:true,adjustmentLevel:'level_0_full_plan',reasonForModification:'Your confirmed check-in supports today’s assigned plan.'}, symptoms:{redFlag:false}, recoveryStatus:{reasoning:'Rest is available.'} })
const schedule = () => ({ date:'2026-10-08',timezone:zone,now:'2026-10-08T20:40:00Z',events:[],nextActionableEvent:null })
test('Chicago morning/afternoon and local day rollover share one clock', () => {
 assert.equal(time.getGreeting(new Date('2026-10-08T13:00:00Z'),zone),'Good Morning')
 assert.equal(time.getGreeting(new Date('2026-10-08T20:40:00Z'),zone),'Good Afternoon')
 assert.equal(time.getLocalDaypart(new Date('2026-10-08T20:40:00Z'),zone),'midday')
 assert.equal(time.getClientLocalDate({timezone:zone},new Date('2026-10-09T04:59:00Z')),'2026-10-08')
 assert.equal(time.getClientLocalDate({timezone:zone},new Date('2026-10-09T05:00:00Z')),'2026-10-09')
 assert.equal(time.getClientLocalDate({timezone:'Pacific/Auckland'},new Date('2026-10-08T20:40:00Z')),'2026-10-09')
})
test('DST days have correct bounds; calendar uses user timezone', () => {
 for(const [date,hours] of [['2026-03-08',23],['2026-11-01',25]]) {
  const range = scheduleTime.getClientDayRange({timezone:zone},date)
  assert.equal((range.end-range.start)/3600000,hours)
  assert.equal(time.localDateKey(range.start,zone),date)
 }
 assert.equal(calendar.eventDateKey({start_at:'2026-10-09T03:00:00Z'},zone),'2026-10-08')
 assert.equal(calendar.buildMonthGrid({selectedDate:'2026-03-08',items:[],today:'2026-03-08'}).filter(c=>c.isToday).length,1)
 const nonexistent = scheduleTime.zonedDateTimeToUtc('2026-03-08','02:30',zone)
 assert.notEqual(time.getLocalMinutes(nonexistent,zone),150)
})
test('civil day boundaries advance through midnight gaps and folds use the first occurrence', () => {
 const havana=scheduleTime.getClientDayRange({timezone:'America/Havana'},'2026-03-08')
 assert.equal(havana.start.toISOString(),'2026-03-08T05:00:00.000Z')
 assert.equal(time.localDateKey(havana.start,'America/Havana'),'2026-03-08')
 assert.equal((havana.end-havana.start)/3600000,23)
 assert.equal(scheduleTime.zonedDateTimeToUtc('2026-10-25','01:30','Europe/London').toISOString(),'2026-10-25T00:30:00.000Z')
 assert.equal(scheduleTime.zonedDateTimeToUtc('2026-03-08','02:30',zone).toISOString(),'2026-03-08T08:30:00.000Z')
})
test('rescheduled events appear on their new local day while retaining original times',async()=>{
 const event={id:'moved',start_at:'2026-10-08T18:00:00Z',end_at:'2026-10-08T18:30:00Z',adjusted_start_at:'2026-10-09T19:00:00Z',adjusted_end_at:'2026-10-09T19:30:00Z'}
 let requestedFilter=''
 const db={from(){const query={select(){return query},eq(){return query},or(filter){requestedFilter=filter;return query},order:async()=>({data:[event],error:null})};return query}}
 const load=async date=>{const day=scheduleTime.getClientDayRange({timezone:zone},date);return loadScheduleEventsForDay({supabase:db,userId:'qa-user',clientId:'QA-ONLY',dayStart:day.start,dayEnd:day.end})}
 assert.equal((await load('2026-10-08')).length,0)
 assert.deepEqual(await load('2026-10-09'),[event])
 assert.match(requestedFilter,/adjusted_start_at/)
 assert.equal(event.start_at,'2026-10-08T18:00:00Z')
})
test('unblocked space stays open; proposed training conflicts require explicit acceptance',()=>{
 const client={client_id:'QA-ONLY',program:'phoenix',wake_time:'07:00',work_start_time:'09:00',work_end_time:'17:00',preferred_workout_time:'16:00',current_workout_minutes_per_session:30}
 const events=dailyPlanToScheduleEvents({userId:'qa-user',client,dailyPlan:{date:'2026-10-08',timezone:zone,timing:{},completedDailyTasks:[]}})
 assert.deepEqual(events.map(event=>event.event_type),['work','workout'])
 const workout=events.find(event=>event.event_type==='workout')
 assert.equal(workout.suggested,true)
 const day=scheduleTime.getClientDayRange({timezone:zone},'2026-10-08')
 const windows=getOpenWindows(events,day.start,day.end,10,10)
 assert.equal(windows.length,2)
 const [suggestion]=buildScheduleAdjustments({events,openWindows:windows,now:new Date('2026-10-08T20:40:00Z'),transitionMinutes:10})
 assert.equal(suggestion.automatic,false)
 assert.match(suggestion.reason,/conflicts/)
 assert.equal(time.getLocalMinutes(new Date(suggestion.suggested_start_at),zone),17*60+10)
 assert.equal(workout.adjusted_start_at,null)
 assert.equal(scheduleConflict(events,'qa-new',new Date('2026-10-08T23:00Z'),new Date('2026-10-08T23:30Z'),10),null)
})
test('missing food/water and no recorded workout remain unknown, with a small useful input', () => {
 const logic=fixture(), plan=buildDailyRecommendation(logic,schedule())
 assert.deepEqual(plan.evidence,{food:'not_logged',water:'not_logged',workout:'not_logged',checkIn:'not_logged'})
 assert.equal(plan.primary.id,'check-in')
 assert.match(plan.supporting.find(a=>a.id==='food-input').reason,/does not tell us/)
 logic.assessments.dailyCompleted=true;logic.nutrition.dataStatus='ready';logic.hydration.status='below_target';logic.hydration.consumed=8
 const known=buildDailyRecommendation(logic,schedule())
 assert.equal(known.evidence.food,'partial');assert.equal(known.evidence.water,'partial')
 assert.doesNotMatch(known.primary.reason,/already created|no food consumed/)
 logic.execution.workoutInProgress=true
 const partial=buildDailyRecommendation(logic,schedule())
 assert.equal(partial.evidence.workout,'partial')
 assert.equal(partial.supporting.find(action=>action.id==='workout').title,'Resume today’s workout')
})
test('all tiers and sections consume the same priority and timestamp; recorded workouts support completion', () => {
 for(const tier of ['ember','ignite','phoenix']) {
  const logic=fixture();logic.program=tier
  const state=schedule();state.dailyRecommendation=buildDailyRecommendation(logic,state)
  const next=buildWhatsNextState({tier,capabilities:getTierCapabilities(tier),logic,schedule:state})
  assert.equal(next.title,state.dailyRecommendation.primary.title)
  assert.equal(next.primaryAction.href,state.dailyRecommendation.primary.href)
  assert.equal(state.dailyRecommendation.generatedAt,state.now)
 }
 const logic=fixture();logic.assessments.dailyCompleted=true;logic.nutrition.dataStatus='ready';logic.nutrition.calories.percent=100;logic.nutrition.protein.percent=100;logic.hydration.status='on_target';logic.hydration.remaining=0;logic.execution.workoutComplete=true
 const plan=buildDailyRecommendation(logic,schedule())
 assert.equal(plan.primary.id,'recovery');assert.match(plan.primary.reason,/Strength day/)
})
test('hydration distinguishes missing intake and never recommends evening catch-up dosing', () => {
 const missing=calculateHydrationPacing({target:111,consumed:0,hasLoggedIntake:false,localTimeMinutes:21*60,wakeTime:'07:00',bedTime:'22:00'})
 assert.equal(missing.state,'insufficient_data')
 const late=calculateHydrationPacing({target:111,consumed:8,hasLoggedIntake:true,localTimeMinutes:21*60,wakeTime:'07:00',bedTime:'22:00'})
 assert.match(late.prompt,/steady/);assert.doesNotMatch(late.prompt,/111|103|10 min|finish|catch up/)
 const beforeWake=calculateHydrationPacing({target:111,consumed:8,hasLoggedIntake:true,localTimeMinutes:5*60,wakeTime:'07:00',bedTime:'22:00'})
 assert.equal(beforeWake.dayElapsedPercent,0)
})
test('activity prescriptions match strength, walking, breathing and mobility; partial and skipped never count as complete', () => {
 const performance=summarizeStrengthSets([{reps:8,weight:10,weight_unit:'kg'},{reps:6,weight:10,weight_unit:'kg'}])
 assert.equal(performance.actual_reps,7)
 assert.equal(performance.actual_total_reps,14)
 assert.ok(Math.abs(performance.actual_weight-22.046226218)<0.00001)
 assert.deepEqual([activityDose({exercise:'Walking',duration_label:'10 min'}).kind,activityDose({exercise:'Walking',duration_label:'10 min'}).metric],['cardio','minutes'])
 assert.equal(activityDose({exercise:'Breathing',reps:'5 breaths'}).metric,'breaths')
 assert.equal(activityDose({exercise:'Mobility flow',duration_seconds:30}).metric,'seconds')
 const strength=activityDose({exercise:'Squat',sets:3,recommended_reps:8,recommended_weight:22.046226218,load_type:'per_hand',equipment_increment:2.5},'kg')
 assert.equal(strength.kind,'strength');assert.equal(strength.weight,10);assert.equal(strength.loadLabel,'per hand');assert.equal(strength.increment,1.134)
 const counts=workoutCompletion([{completed:true},{completed:false,set_logs:[{reps:8}]},{skipped:true}])
 assert.deepEqual(counts,{complete:1,partial:1,skipped:1,total:3,completed:false})
 assert.equal(workoutCompletion([{completed:true},{completed:true}]).completed,true)
})
test('overnight recurring commitments and buffers leave real unallocated space', () => {
 const blocks=[{id:'sleep',block_type:'sleep',days_of_week:[3],start_time:'22:00',end_time:'07:00',active:true},{id:'work',block_type:'work',days_of_week:[4],start_time:'09:00',end_time:'17:00',active:true}]
 const windows=getAvailableWindows(blocks,4,10,15)
 assert.deepEqual(windows,[{start:'07:15',end:'08:45',minutes:90},{start:'17:15',end:'24:00',minutes:405}])
 const events=recurringCommitmentsToEvents({userId:'qa',client:{client_id:'qa'},date:'2026-10-08',timezone:zone,blocks})
 assert.equal(events.length,2);assert.equal(time.localDateKey(new Date(events[0].start_at),zone),'2026-10-07')
 assert.match(scheduleConflict(events,'new',new Date('2026-10-08T13:50Z'),new Date('2026-10-08T14:10Z'),15),/work/)
 assert.equal(scheduleConflict(events,'new',new Date('2026-10-08T22:30Z'),new Date('2026-10-08T23:00Z'),15),null)
})
test('shared symptom answers deduplicate names without fabricating severity or changing history', () => {
 const logs=[{id:'a',symptom_types:{name:'Headache'},severity:4,created_at:'2026-10-08T19:00Z'},{id:'b',symptom_types:{name:'Headache'},severity:2,created_at:'2026-10-08T18:00Z'}]
 const saved=structuredClone(logs),result=mergeDailySymptoms(logs,{headache:true,fatigue:true,created_at:'2026-10-08T18:00Z'})
 assert.equal(result.length,2);assert.equal(result.find(r=>r.id==='a').severity,4);assert.equal(result.find(r=>r.symptom_name==='fatigue').severity,null);assert.deepEqual(logs,saved)
})

test('current calendar commitments lead What’s Next while urgent recovery keeps priority',()=>{
 const logic=fixture(),state=schedule()
 state.events=[{id:'calendar-current',title:'School pickup',source:'external_calendar',source_label:'Google · Family',event_type:'personal',flexibility_type:'fixed',status:'scheduled',start_at:'2026-10-08T20:00:00Z',end_at:'2026-10-08T21:00:00Z',adjusted_start_at:null,adjusted_end_at:null}]
 state.dailyRecommendation=buildDailyRecommendation(logic,state)
 assert.equal(state.dailyRecommendation.primary.id,'calendar-current')
 const next=buildWhatsNextState({tier:'ignite',capabilities:getTierCapabilities('ignite'),logic,schedule:state})
 assert.equal(next.type,'calendar_event');assert.match(next.subtitle,/Google · Family/)
 logic.symptoms.redFlag=true
 assert.equal(buildDailyRecommendation(logic,state).primary.id,'safety')
})
