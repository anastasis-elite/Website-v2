import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { PhoenixCapacity, PhoenixDashboardData, PhoenixPlanBlock } from './types'

function capacity(engine: ProgramLogicOutput): PhoenixCapacity {
  return engine.capacityStatus.status === 'high_capacity' ? 'high' : engine.capacityStatus.status === 'moderate_capacity' ? 'medium' : 'low'
}

function blocks(engine: ProgramLogicOutput): PhoenixPlanBlock[] {
  const saved = new Set(engine.todayPlan.phoenixTaskIds)
  const complete = (id:string,tracked=false)=>saved.has(id)||tracked
  const capacityLevel = capacity(engine)
  const all: PhoenixPlanBlock[] = [
    {id:'morning',title:'Morning',focus:'Hydrate + fuel',tasks:[
      {id:'morning-water',label:'Drink water',detail:engine.hydration.prompt,href:'/dashboard/nutrition',complete:complete('morning-water',engine.hydration.percent>=80)},
      {id:'morning-breakfast',label:'Simple breakfast',detail:engine.nutrition.mealSuggestions[0]||'Add protein when you can.',href:'/dashboard/nutrition',complete:complete('morning-breakfast')},
      {id:'morning-checkin',label:'Morning check-in',detail:'How are you feeling?',href:'/dashboard/check-in',complete:complete('morning-checkin',engine.assessments.dailyCompleted),secondary:capacityLevel==='high'},
    ]},
    {id:'midday',title:'Midday',focus:'Stay on track',tasks:[
      {id:'midday-lunch',label:'Eat lunch',detail:'Balance + protein.',href:'/dashboard/nutrition',complete:complete('midday-lunch')},
      {id:'midday-movement',label:engine.workoutDecision.adjustmentLevel==='level_3_recovery_training'?'Gentle movement':'Move your body',detail:engine.workoutDecision.intensityTarget,href:'/dashboard/program/phoenix/workout',complete:complete('midday-movement',engine.execution.workoutComplete)},
      {id:'midday-checkin',label:'Midday check-in',detail:'Energy + stress.',href:'/dashboard/check-in',complete:complete('midday-checkin',engine.recoveryCheck.completed),secondary:capacityLevel==='high'},
    ]},
    {id:'evening',title:'Evening',focus:'Reset + reflect',tasks:[
      {id:'evening-dinner',label:'Eat dinner',detail:engine.fuelReadiness.postWorkoutPriority,href:'/dashboard/nutrition',complete:complete('evening-dinner')},
      {id:'evening-wind-down',label:'Wind down',detail:engine.recoveryStatus.reasoning,href:'/dashboard/recovery',complete:complete('evening-wind-down')},
      {id:'evening-checkin',label:'Evening check-in',detail:'How was your day?',href:'/dashboard/check-in',complete:complete('evening-checkin',engine.recoveryCheck.completed),secondary:capacityLevel==='high'},
    ]},
  ]
  const missed=engine.flameState.requirements.missedDayCount
  if(missed>=3)return [{id:'morning',title:'Reset',focus:'One step at a time',tasks:[all[0].tasks[2],all[1].tasks[1]]}]
  if(missed>=2)return [{...all[0],tasks:[all[0].tasks[2]]},{...all[1],tasks:[all[1].tasks[1]]}]
  if(missed>=1)return [{...all[0],tasks:[all[0].tasks[0],all[0].tasks[2]]},{...all[1],tasks:[all[1].tasks[1]]}]
  return all.map((block)=>({...block,tasks:block.tasks.slice(0,engine.presentation.maxTasksPerBlock)}))
}

export function getPhoenixDashboardData(engine: ProgramLogicOutput, trackLabel: string): PhoenixDashboardData {
  const capacityLevel = capacity(engine)
  return {
    clientId:engine.client.id,clientName:engine.client.name,streak:engine.flameState.streak,capacity:capacityLevel,trackLabel,
    water:{consumed:engine.hydration.consumed,target:engine.hydration.target,increment:8},
    macros:[
      {key:'protein',label:'Protein',consumed:engine.nutrition.protein.consumed,target:engine.nutrition.protein.target},
      {key:'carbs',label:'Carbs',consumed:engine.nutrition.carbs.consumed,target:engine.nutrition.carbs.target},
      {key:'fats',label:'Fats',consumed:engine.nutrition.fats.consumed,target:engine.nutrition.fats.target},
    ],
    workout:{assigned:engine.workout.assigned,completed:engine.workout.completed,title:engine.workout.title},
    assessment:{completed:engine.assessments.dailyCompleted},recovery:{completed:engine.recoveryCheck.completed},sleep:engine.sleep,
    plan:blocks(engine),
    focus:capacityLevel==='low'?{message:engine.insight.concise,intention:'Support my body with the next simple step.'}:capacityLevel==='medium'?{message:engine.insight.concise,intention:'Take care of my body in three simple ways.'}:{message:engine.insight.concise,intention:'Complete the plan, then choose one optional stretch.'},
  }
}
