import type { DailyTraining } from './dailyTraining'

export type DataAvailability = 'not_logged' | 'partial' | 'confirmed' | 'completed'
export type DailyRecommendationAction = {
  id: string; category: string; title: string; reason: string; href: string
  availability: DataAvailability; eventId?: string; completed: boolean
}
export type DailyRecommendation = {
  date: string; timezone: string; generatedAt: string
  primary: DailyRecommendationAction; supporting: DailyRecommendationAction[]
  training: DailyTraining
  evidence: { food: DataAvailability; water: DataAvailability; workout: DataAvailability; checkIn: DataAvailability }
}
