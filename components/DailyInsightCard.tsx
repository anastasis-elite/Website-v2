import { generateDailyInsight } from '@/lib/messaging/engine'

export default function DailyInsightCard() {
  const insight = generateDailyInsight()

  return (
    <div>
      <p>{insight.observation}</p>
      <p>{insight.meaning}</p>
      <p>{insight.identityShift}</p>
      <p>{insight.nextStep}</p>
    </div>
  )
}
