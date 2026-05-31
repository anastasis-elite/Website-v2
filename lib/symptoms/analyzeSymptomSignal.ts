export type CyclePhase =
  | 'menstrual'
  | 'follicular'
  | 'ovulatory'
  | 'luteal'
  | 'unknown'

export type SymptomSignalInput = {
  symptomName: string
  symptomCategory?: string | null
  severity?: number | null

  cyclePhase?: CyclePhase
  cycleDay?: number | null
  repeatedInSameCycleWindow?: boolean

  minutesAfterMeal?: number | null
  repeatedAfterSameFoodOrTag?: boolean
  recentFoodTags?: string[]

  caffeineMgToday?: number | null
  minutesAfterCaffeine?: number | null

  trainingToday?: boolean
  highOutputBlockToday?: boolean
  stressRating?: number | null
  sleepHours?: number | null
}

export type SymptomSignalResult = {
  likelyCycleRelated: boolean
  likelyFoodRelated: boolean
  likelyCaffeineRelated: boolean
  likelyLoadRelated: boolean
  confidenceScore: number
  analysisNote: string
}

const cycleLinkedSymptoms = [
  'headache',
  'water retention',
  'bloating',
  'fatigue',
  'irritability',
  'anxiety',
  'low mood',
  'cravings',
  'joint pain',
  'muscle pain',
]

const foodLinkedSymptoms = [
  'bloating',
  'gas',
  'reflux',
  'nausea',
  'diarrhea',
  'constipation',
  'headache',
  'itching',
  'flushing',
  'congestion',
  'rapid heart rate',
]

const caffeineLinkedSymptoms = [
  'anxiety',
  'rapid heart rate',
  'reflux',
  'headache',
  'shakiness',
  'dizziness',
  'irritability',
]

const loadLinkedSymptoms = [
  'fatigue',
  'brain fog',
  'headache',
  'irritability',
  'anxiety',
  'muscle pain',
  'joint pain',
]

function normalize(value?: string | null) {
  return String(value || '').toLowerCase().trim()
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function analyzeSymptomSignal(
  input: SymptomSignalInput
): SymptomSignalResult {
  const symptom = normalize(input.symptomName)

  let cycleScore = 0
  let foodScore = 0
  let caffeineScore = 0
  let loadScore = 0

  if (cycleLinkedSymptoms.includes(symptom)) {
    cycleScore += 20
  }

  if (
    input.cyclePhase === 'menstrual' ||
    input.cyclePhase === 'luteal' ||
    input.cyclePhase === 'ovulatory'
  ) {
    cycleScore += 15
  }

  if (input.repeatedInSameCycleWindow) {
    cycleScore += 35
  }

  if (foodLinkedSymptoms.includes(symptom)) {
    foodScore += 20
  }

  if (
    typeof input.minutesAfterMeal === 'number' &&
    input.minutesAfterMeal >= 0 &&
    input.minutesAfterMeal <= 360
  ) {
    foodScore += 30
  }

  if (input.repeatedAfterSameFoodOrTag) {
    foodScore += 35
  }

  if (input.recentFoodTags?.length) {
    const triggerTags = [
      'contains_dairy',
      'contains_lactose',
      'contains_gluten',
      'contains_soy',
      'contains_egg',
      'high_histamine',
      'high_fodmap',
      'high_sodium',
      'additive_risk',
    ]

    const hasTriggerTag = input.recentFoodTags.some((tag) =>
      triggerTags.includes(tag)
    )

    if (hasTriggerTag) {
      foodScore += 15
    }
  }

  if (caffeineLinkedSymptoms.includes(symptom)) {
    caffeineScore += 25
  }

  if ((input.caffeineMgToday || 0) > 0) {
    caffeineScore += 15
  }

  if (
    typeof input.minutesAfterCaffeine === 'number' &&
    input.minutesAfterCaffeine >= 0 &&
    input.minutesAfterCaffeine <= 240
  ) {
    caffeineScore += 35
  }

  if ((input.caffeineMgToday || 0) >= 200) {
    caffeineScore += 15
  }

  if (loadLinkedSymptoms.includes(symptom)) {
    loadScore += 20
  }

  if (input.trainingToday) {
    loadScore += 15
  }

  if (input.highOutputBlockToday) {
    loadScore += 20
  }

  if ((input.stressRating || 0) >= 7) {
    loadScore += 20
  }

  if (typeof input.sleepHours === 'number' && input.sleepHours < 6.5) {
    loadScore += 20
  }

  const scores = {
    cycle: clampScore(cycleScore),
    food: clampScore(foodScore),
    caffeine: clampScore(caffeineScore),
    load: clampScore(loadScore),
  }

  const topScore = Math.max(
    scores.cycle,
    scores.food,
    scores.caffeine,
    scores.load
  )

  const likelyCycleRelated = scores.cycle >= 45
  const likelyFoodRelated = scores.food >= 45
  const likelyCaffeineRelated = scores.caffeine >= 45
  const likelyLoadRelated = scores.load >= 45

  const likelySources = [
    likelyCycleRelated ? 'cycle phase' : null,
    likelyFoodRelated ? 'recent food intake' : null,
    likelyCaffeineRelated ? 'caffeine or stimulant timing' : null,
    likelyLoadRelated ? 'training, stress, sleep, or output load' : null,
  ].filter(Boolean)

  const analysisNote = likelySources.length
    ? `This symptom may be connected to ${likelySources.join(
        ', '
      )}. More repeated logs will improve confidence.`
    : 'No strong pattern is clear yet. Continue logging timing, food, cycle phase, caffeine, sleep, and daily load.'

  return {
    likelyCycleRelated,
    likelyFoodRelated,
    likelyCaffeineRelated,
    likelyLoadRelated,
    confidenceScore: topScore,
    analysisNote,
  }
}
