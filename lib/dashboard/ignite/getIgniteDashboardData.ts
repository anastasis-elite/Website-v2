import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { IgniteDashboardData, IgnitePlanBlock } from './types'

function plan(engine: ProgramLogicOutput): IgnitePlanBlock[] {
  const nutrition = engine.execution.nutritionLogged
  return [
    { id:'morning',title:'Morning',focus:'Hydrate + fuel',tasks:[
      {id:'morning-water',label:'Build hydration momentum',href:'/dashboard/nutrition',complete:engine.hydration.percent>=35,autoTracked:true},
      {id:'morning-breakfast',label:'Protein-focused first meal',href:'/dashboard/nutrition',complete:nutrition,autoTracked:true},
      {id:'morning-assessment',label:'Morning check-in',href:'/dashboard/check-in',complete:engine.assessments.dailyCompleted,autoTracked:true},
    ]},
    { id:'midday',title:'Midday',focus:'Stay on track',tasks:[
      {id:'midday-protein',label:'Protect your protein target',href:'/dashboard/nutrition',complete:engine.nutrition.protein.percent>=60,autoTracked:true},
      {id:'midday-walk',label:'10 minute walk',href:'/dashboard/day/midday',complete:false,autoTracked:false},
      {id:'midday-lunch',label:'Check in + log lunch',href:'/dashboard/nutrition',complete:nutrition,autoTracked:true},
    ]},
    { id:'evening',title:'Evening',focus:'Recover + reflect',tasks:[
      {id:'evening-workout',label:engine.workout.assigned?'Complete workout':'Honor recovery day',href:'/dashboard/program/ignite/workout',complete:engine.execution.workoutComplete,autoTracked:true},
      {id:'evening-nutrition',label:'Post-workout nutrition',href:'/dashboard/nutrition',complete:nutrition,autoTracked:true},
      {id:'evening-recovery',label:'Evening check-in',href:'/dashboard/check-in',complete:engine.recoveryCheck.completed,autoTracked:true},
    ]},
  ]
}

export function getIgniteDashboardData(engine: ProgramLogicOutput): IgniteDashboardData {
  return {
    clientId:engine.client.id,clientName:engine.client.name,streak:engine.flameState.streak,
    water:{consumed:engine.hydration.consumed,target:engine.hydration.target},
    macros:[
      {key:'protein',label:'Protein',consumed:engine.nutrition.protein.consumed,target:engine.nutrition.protein.target,unit:'g'},
      {key:'carbs',label:'Carbs',consumed:engine.nutrition.carbs.consumed,target:engine.nutrition.carbs.target,unit:'g'},
      {key:'fats',label:'Fats',consumed:engine.nutrition.fats.consumed,target:engine.nutrition.fats.target,unit:'g'},
      {key:'calories',label:'Calories',consumed:engine.nutrition.calories.consumed,target:engine.nutrition.calories.target,unit:'cal'},
    ],
    workout:{assigned:engine.workout.assigned,completed:engine.workout.completed,title:engine.workout.title,type:engine.workout.type,durationMinutes:engine.workout.durationMinutes},
    assessment:{dailyCompleted:engine.assessments.dailyCompleted,monthlyDueCount:engine.assessments.monthlyDueCount,completedPercent:engine.assessments.completionPercent},
    recovery:{completed:engine.recoveryCheck.completed,energy:engine.recoveryCheck.energy,stress:engine.recoveryCheck.stress,sleep:engine.recoveryCheck.sleepQuality,soreness:engine.recoveryCheck.soreness},
    cycle:{enabled:engine.cycle.enabled,phase:engine.cycle.phase,day:engine.cycle.day,recommendation:engine.cycle.trainingAdjustment},
    plan:plan(engine),trends:engine.trends,progress:engine.progress,baseInsight:engine.insight.concise,
  }
}
