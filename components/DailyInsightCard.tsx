type DailyInsight = {
  observation?: string
  meaning?: string
  identityShift?: string
  beliefChallenge?: string
  nextStep?: string
}

type Props = {
  insight: DailyInsight
}

export default function DailyInsightCard({ insight }: Props) {
  return (
    <div>
      {insight.observation ? <p>{insight.observation}</p> : null}
      {insight.meaning ? <p>{insight.meaning}</p> : null}
      {insight.identityShift ? <p>{insight.identityShift}</p> : null}
      {insight.beliefChallenge ? <p>{insight.beliefChallenge}</p> : null}
      {insight.nextStep ? <p>{insight.nextStep}</p> : null}
    </div>
  )
}
