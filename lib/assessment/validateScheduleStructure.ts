export type ScheduleStructureAnswers = Record<string, string | number | string[] | null>

const timeFields = [
  'wake_time', 'bed_time', 'work_start_time', 'work_end_time',
  'preferred_workout_time', 'school_dropoff_time', 'school_pickup_time',
  'lunch_window_time', 'dinner_window_time',
] as const

function wholeNumber(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const number = Number(value)
  return Number.isInteger(number) && number >= min && number <= max ? number : null
}

// The same requirements govern the form, the submission endpoint, and saved
// completion evidence. Optional preferences alone never prove completion.
export function validateScheduleStructure(input: unknown): { answers: ScheduleStructureAnswers } | { error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Complete the assessment before submitting.' }
  const value = input as Record<string, unknown>
  if (!['schedule', 'flow', 'hybrid'].includes(String(value.execution_style))) return { error: 'Choose how you want the system to guide you.' }
  if (!['section', 'step'].includes(String(value.carousel_style))) return { error: 'Choose a dashboard style.' }
  const answers: ScheduleStructureAnswers = {
    execution_style: String(value.execution_style), carousel_style: String(value.carousel_style),
  }
  for (const field of timeFields) {
    const time = value[field]
    if (time == null || time === '') { answers[field] = null; continue }
    if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(time)) return { error: 'Enter valid times for your daily anchors.' }
    answers[field] = time.slice(0, 5)
  }
  if (!answers.wake_time || !answers.bed_time) return { error: 'Enter your wake time and bed time.' }
  if (Boolean(answers.work_start_time) !== Boolean(answers.work_end_time)) return { error: 'Enter both work start and end times, or leave both blank.' }
  const available = wholeNumber(value.workout_days_available, 0, 7)
  if (available === null) return { error: 'Choose how many days your life can hold training, including zero.' }
  answers.workout_days_available = available
  if (available > 0) {
    const current = wholeNumber(value.current_workout_days_per_week, 0, 7)
    const duration = wholeNumber(value.current_workout_minutes_per_session, 1, 240)
    if (current === null || duration === null ||
      !['gentle', 'moderate', 'hard', 'very-hard'].includes(String(value.current_training_intensity)) ||
      !['scheduled', 'reminder', 'suggested', 'hidden-for-now'].includes(String(value.workout_schedule_preference))) {
      return { error: 'Complete your current training days, workout length, intensity, and scheduling preference.' }
    }
    answers.current_workout_days_per_week = current
    answers.current_workout_minutes_per_session = duration
    answers.current_training_intensity = String(value.current_training_intensity)
    answers.workout_schedule_preference = String(value.workout_schedule_preference)
  } else {
    answers.current_workout_days_per_week = 0
    answers.current_workout_minutes_per_session = null
    answers.current_training_intensity = null
    answers.workout_schedule_preference = 'hidden-for-now'
  }
  if (value.daily_non_negotiables != null && (!Array.isArray(value.daily_non_negotiables) ||
    value.daily_non_negotiables.length > 30 || value.daily_non_negotiables.some(item => typeof item !== 'string' || item.length > 100))) {
    return { error: 'Choose valid daily anchors.' }
  }
  if (value.day_structure_notes != null && (typeof value.day_structure_notes !== 'string' || value.day_structure_notes.length > 5000)) return { error: 'Keep your notes under 5,000 characters.' }
  answers.daily_non_negotiables = [...new Set((value.daily_non_negotiables || []) as string[])]
  answers.day_structure_notes = typeof value.day_structure_notes === 'string' ? value.day_structure_notes.trim() : null
  return { answers }
}
