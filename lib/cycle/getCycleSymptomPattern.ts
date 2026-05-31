type SymptomPrediction = {
  key: string
  label: string
  mostCommonIntensity: 'mild' | 'moderate' | 'heavy'
  count: number
}

const symptomLabels: Record<string, string> = {
  bleeding: 'Bleeding',
  cramps: 'Cramps',
  headache: 'Headache',
  fatigue: 'Fatigue',
  mood_sensitivity: 'Mood sensitivity',
  bloating: 'Bloating',
  breast_tenderness: 'Breast tenderness',
  nausea: 'Nausea',
  cravings: 'Cravings',
  sleep_disruption: 'Sleep disruption',
}

const fallbackByPhase: Record<string, string[]> = {
  menstrual: ['bleeding', 'cramps', 'fatigue'],
  follicular: ['fatigue', 'mood_sensitivity', 'cravings'],
  ovulatory: ['bloating', 'mood_sensitivity', 'breast_tenderness'],
  luteal: ['fatigue', 'cravings', 'mood_sensitivity'],
  extended_cycle: ['fatigue', 'mood_sensitivity', 'bloating'],
}

const intensityRank: Record<string, number> = {
  mild: 1,
  moderate: 2,
  heavy: 3,
}

function normalizeIntensity(value: unknown): 'mild' | 'moderate' | 'heavy' | null {
  if (value !== 'mild' && value !== 'moderate' && value !== 'heavy') {
    return null
  }

  return value
}

function getMostCommonIntensity(values: string[]) {
  const counts = values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] || 0) + 1
    return acc
  }, {})

  return Object.entries(counts).sort((a, b) => {
    const countDifference = b[1] - a[1]

    if (countDifference !== 0) return countDifference

    return intensityRank[b[0]] - intensityRank[a[0]]
  })[0]?.[0] as 'mild' | 'moderate' | 'heavy'
}

export function getCycleSymptomPattern({
  logs,
  cycleDay,
  phase,
}: {
  logs: any[]
  cycleDay: number | null
  phase?: string | null
}): SymptomPrediction[] {
  if (!cycleDay) return []

  const matchingLogs = logs
    .filter((log) => Number(log.cycle_day) === Number(cycleDay))
    .slice(0, 5)

  const symptomIntensityMap: Record<string, string[]> = {}

  for (const log of matchingLogs) {
    const symptoms = log.symptoms || {}

    Object.entries(symptoms).forEach(([key, value]) => {
      const intensity = normalizeIntensity(value)

      if (!intensity) return

      if (!symptomIntensityMap[key]) {
        symptomIntensityMap[key] = []
      }

      symptomIntensityMap[key].push(intensity)
    })
  }

  const predictions = Object.entries(symptomIntensityMap)
    .map(([key, intensities]) => ({
      key,
      label: symptomLabels[key] || key.replaceAll('_', ' '),
      mostCommonIntensity: getMostCommonIntensity(intensities),
      count: intensities.length,
    }))
    .filter((item) => item.count >= 3)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  if (predictions.length) {
    return predictions
  }

  const fallbackKeys =
    fallbackByPhase[phase || ''] || ['fatigue', 'cramps', 'mood_sensitivity']

  return fallbackKeys.slice(0, 3).map((key) => ({
    key,
    label: symptomLabels[key] || key.replaceAll('_', ' '),
    mostCommonIntensity: 'moderate',
    count: 0,
  }))
}
