export const memberAssessmentSections = [
    { title: 'Training', fields: [
      { name: 'trainingDays', label: 'Training days per week', options: [['1','1 day'],['2','2 days'],['3','3 days'],['4','4 days'],['5','5 days'],['6','6 days'],['7','7 days']] },
      { name: 'experienceLevel', label: 'Training experience', options: [['beginner','Beginner'],['some-experience','Some experience'],['consistent','Consistent lifter'],['advanced','Advanced']] },
      { name: 'equipmentAccess', label: 'Equipment access', options: [['commercial-gym','Commercial gym'],['home-gym','Home gym'],['dumbbells-bands','Dumbbells / bands only'],['bodyweight','Bodyweight only']] },
    ] },
    { title: 'Goals & limitations', fields: [
      { name: 'primaryFocus', label: 'Primary goal', options: [['recomposition','Body recomposition'],['fat-loss','Fat loss'],['muscle-building','Muscle building'],['strength','Strength'],['glutes-shape','Glutes / shape'],['stage-prep','Stage or transformation prep'],['energy-regulation','Energy, consistency, and regulation']] },
      { name: 'currentLimitations', label: 'Movements, injuries, pain points or limitations', placeholder: 'Share anything relevant. If none, write none.' },
    ] },
    { title: 'Recovery', fields: [
      { name: 'recoveryCapacity', label: 'Current recovery capacity', options: [['low','Low — I feel depleted often'],['moderate','Moderate — I can train but need balance'],['high','High — I recover well']] },
      { name: 'sleepQuality', label: 'Sleep quality', options: [['poor','Poor'],['inconsistent','Inconsistent'],['decent','Decent'],['strong','Strong']] },
      { name: 'stressLevel', label: 'Current stress load', options: [['low','Low'],['moderate','Moderate'],['high','High'],['very-high','Very high']] },
    ] },
    { title: 'Preferences', fields: [
      { name: 'cardioPreference', label: 'Cardio preference', options: [['walking','Walking'],['incline-walk','Incline walk'],['stair-stepper','Stair stepper'],['bike','Bike'],['running','Running'],['minimal','Minimal cardio']] },
    ] },
  ]

export type MemberAssessmentKind = 'initial' | 'quarterly' | 'review'
export type MemberSelections = Record<string, string>

export function memberSelections(client: any, saved: any = {}): MemberSelections {
  const equipment = (client.equipment_access || []).join(', ').toLowerCase()
  const equipmentValue = /commercial/.test(equipment) ? 'commercial-gym' : /home/.test(equipment) ? 'home-gym' : /dumbbell|band/.test(equipment) ? 'dumbbells-bands' : /bodyweight/.test(equipment) ? 'bodyweight' : ''
  const defaults: MemberSelections = {
    program: client.program || '', client_id: client.client_id || '', fullName: client.full_name || '',
    email: client.email || client.login_email || '', birthdate: client.birthdate || '',
    trainingDays: String(client.workout_days_available ?? ''), equipmentAccess: equipmentValue,
    experienceLevel: client.experience_level || '', primaryFocus: client.primary_goal || '',
    currentLimitations: Array.isArray(client.limitations) ? client.limitations.join(', ') : '',
    recoveryCapacity: '', sleepQuality: '', stressLevel: '', cardioPreference: '', notes: '',
  }
  // Saved answers may predate profile edits. Identity always comes from the
  // authenticated profile; only the form's actual answer fields are restored.
  for (const key of [...memberAssessmentSections.flatMap(section => section.fields.map(field => field.name)), 'notes']) {
    const value = saved?.[key]
    if (typeof value === 'string' || typeof value === 'number') defaults[key] = String(value)
  }
  return defaults
}

export function memberFieldValid(name: string, value: unknown) {
  const field = memberAssessmentSections.flatMap(section => section.fields).find(field => field.name === name)
  if (!field) return false
  if ('options' in field && field.options) return field.options.some(([option]) => option === String(value))
  return typeof value === 'string' && Boolean(value.trim())
}

export function validMemberSelections(value: any) {
  return value && typeof value === 'object' && !Array.isArray(value) && memberAssessmentSections.every(section => section.fields.every(field => memberFieldValid(field.name, value[field.name])))
}
