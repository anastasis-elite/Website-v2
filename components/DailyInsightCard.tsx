import { generateDailyInsight } from '@/lib/messaging/engine'

export default function DailyInsightCard() {
  const insight = generateDailyInsight({
  cyclePhase: 'luteal',
  capacity: 'low',
  completions: 3,
  belief: 'i_should_be_doing_more',
})

  return (
    <div>
      <p>{insight.observation}</p>
      <p>{insight.meaning}</p>
      <p>{insight.identityShift}</p>
      <p>{insight.nextStep}</p>
    </div>
  )
}
