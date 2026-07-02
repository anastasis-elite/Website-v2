import type { ProgramLogicOutput } from '@/lib/dashboard/logic/types'
import type { EmberDashboardData } from './types'

export function getEmberDashboardData(engine: ProgramLogicOutput): EmberDashboardData {
  return {
    clientId: engine.client.id,
    clientName: engine.client.name,
    streak: engine.flameState.streak,
    water: { consumed: engine.hydration.consumed, target: engine.hydration.target, increment: 8 },
    macros: [
      { key:'protein',label:'Protein',...engine.nutrition.protein,unit:'g' },
      { key:'carbs',label:'Carbs',...engine.nutrition.carbs,unit:'g' },
      { key:'fats',label:'Fats',...engine.nutrition.fats,unit:'g' },
      { key:'calories',label:'Calories',...engine.nutrition.calories,unit:'cal' },
    ].map(({ key,label,consumed,target,unit }) => ({ key:key as any,label,consumed,target,unit:unit as any })),
    workout: { name:engine.workout.title,type:engine.workout.type,assigned:engine.workout.assigned,completed:engine.workout.completed },
    assessment: { required:true,completed:engine.assessments.dailyCompleted,label:'Daily assessment' },
    recovery: { required:true,completed:engine.recoveryCheck.completed,label:'How do you feel?' },
  }
}
