import type { MicronutrientProgress } from '@/lib/nutrition/micronutrientProgress'

const amountFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

function displayAmount(value: number) {
  return amountFormatter.format(value)
}

export default function MicronutrientProgressRing({ progress, safetyWarning }: {
  progress: MicronutrientProgress
  safetyWarning?: string
}) {
  const incomplete = progress.missingMealCount > 0
  const percent = progress.percent === null ? '—' : `${incomplete ? '≥' : ''}${Math.round(progress.percent)}%`
  const amount = progress.consumed === null ? 'Unknown' : `${incomplete ? 'At least ' : ''}${displayAmount(progress.consumed)} ${progress.unit}`
  const target = progress.target === null ? 'Daily target unavailable' : `Daily target ${displayAmount(progress.target)} ${progress.unit}`
  const warning = safetyWarning || (progress.upperLimitExceeded ? `Above the recorded upper limit of ${displayAmount(progress.upperLimit!)} ${progress.unit}. Review your intake.` : '')
  const explanation = warning || (!progress.mealCount ? 'No food logged today.'
    : progress.consumed === null ? progress.macroEntryCount ? 'Macro-only intake is logged; micronutrient amounts are unknown.' : 'Nutrient data is missing for all logged foods.'
      : progress.macroEntryCount ? `Incomplete data: ${progress.macroEntryCount} macro-only entries have unknown micronutrients.`
      : incomplete ? `Incomplete data: ${progress.missingMealCount} of ${progress.mealCount} foods lack this nutrient or serving weight.`
        : progress.percent !== null && progress.percent > 100 ? 'Above daily target. More is not necessarily better.' : 'From today’s confirmed food logs.')
  return <article className="nutrition-micronutrient-card" data-state={warning ? 'warning' : progress.state}>
    <div className="nutrition-micronutrient-ring" role="img" aria-label={`${progress.label}: ${percent === '—' ? 'percentage unavailable' : `${percent} of daily target`}. ${amount}. ${target}. ${explanation}`}>
      <svg viewBox="0 0 80 80" aria-hidden="true" focusable="false">
        <circle className="nutrition-micronutrient-track" cx="40" cy="40" r="34" fill="none" strokeWidth="6" />
        {progress.ringPercent > 0 ? <circle className="nutrition-micronutrient-fill" cx="40" cy="40" r="34" fill="none" strokeWidth="6" pathLength="100" strokeDasharray={`${progress.ringPercent} 100`} transform="rotate(-90 40 40)" /> : null}
      </svg>
      <strong aria-hidden="true">{percent}</strong>
    </div>
    <div className="nutrition-micronutrient-copy">
      <h3>{progress.label}</h3>
      <strong>{amount}</strong>
      <small>{target}</small>
      <small>{explanation}</small>
    </div>
  </article>
}
