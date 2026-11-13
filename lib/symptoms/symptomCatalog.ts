export type SymptomType = { id: string; name: string; category: string | null }
export type BodyRegion = { id: string; name: string }
export type SymptomArea = 'head' | 'chest' | 'abdomen' | 'pelvis' | 'arms' | 'legs' | 'back'
export type SymptomRoute = SymptomArea | 'period' | 'all'

const areaNames: Record<SymptomArea, string[]> = {
  head: ['headache', 'brain fog', 'dizziness', 'congestion'],
  chest: ['rapid heart rate', 'breast tenderness'],
  abdomen: ['bloating', 'constipation', 'diarrhea', 'gas', 'nausea', 'reflux'],
  pelvis: ['menstrual cramps', 'pelvic pain'],
  arms: ['joint pain', 'muscle pain'],
  legs: ['joint pain', 'muscle pain'],
  back: ['lower back pain', 'muscle pain'],
}

const periodAreaPriority: Partial<Record<SymptomArea, string[]>> = {
  chest: ['breast tenderness'],
  pelvis: ['menstrual cramps', 'pelvic pain'],
  back: ['lower back pain'],
}

const normalized = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// These are catalog names, never IDs. The options endpoint remains authoritative.
const periodNames = new Set([
  'menstrual cramps', 'pelvic pain', 'breast tenderness', 'lower back pain',
  'brain fog', 'bloating', 'constipation', 'diarrhea', 'gas', 'nausea', 'fatigue',
  'joint pain', 'muscle pain', 'water retention', 'cravings', 'shakiness',
  'anxiety', 'irritability', 'low mood', 'dizziness', 'headache',
])

export function periodRelatedSymptoms(symptoms: SymptomType[]): SymptomType[] {
  return symptoms.filter(symptom => periodNames.has(normalized(symptom.name)))
}

export function filterAreaSymptoms(symptoms: SymptomType[], area: SymptomArea, periodContext = false): SymptomType[] {
  const matches = symptoms.filter(symptom => areaNames[area].includes(normalized(symptom.name)))
  if (!periodContext) return matches
  const priority = periodAreaPriority[area] || []
  return [...matches].sort((a, b) => Number(priority.includes(normalized(b.name))) - Number(priority.includes(normalized(a.name))))
}

const regionNames: Record<SymptomArea, string[]> = {
  head: ['head'],
  chest: ['chest heart', 'chest', 'heart'],
  abdomen: ['stomach gut', 'stomach', 'gut', 'abdomen'],
  pelvis: ['pelvis cycle', 'pelvis'],
  arms: ['arms', 'arm'],
  legs: ['legs', 'leg'],
  back: ['back'],
}

const specificSymptomRegions: Record<string, string[]> = {
  'menstrual cramps': regionNames.pelvis,
  'pelvic pain': regionNames.pelvis,
  'breast tenderness': regionNames.chest,
  'lower back pain': ['back'],
  'headache': regionNames.head,
  'bloating': regionNames.abdomen,
  'constipation': regionNames.abdomen,
  'diarrhea': regionNames.abdomen,
  'gas': regionNames.abdomen,
  'nausea': regionNames.abdomen,
  'reflux': regionNames.abdomen,
  'joint pain': ['joints'],
}

export function resolveSymptomBodyRegion(
  regions: BodyRegion[],
  route: SymptomRoute | null,
  symptom: SymptomType | null,
): string | null {
  if (!route) return null
  // Choosing a general symptom through the period/all list does not assert a
  // pelvic location. Use a real anatomical region only when the name identifies it.
  const names = route === 'period' || route === 'all'
    ? specificSymptomRegions[normalized(symptom?.name || '')]
    : regionNames[route]
  if (!names) return null
  return regions.find(region => names.includes(normalized(region.name)))?.id || null
}
