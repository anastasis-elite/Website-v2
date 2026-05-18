import { differenceInCalendarDays } from 'date-fns'

export async function getNextLesson({
  supabase,
  client,
  user,
}: {
  supabase: any
  client: any
  user: any
}) {
  const startedAt = client.started_program_at
    ? new Date(client.started_program_at)
    : new Date()

  const daysInProgram =
    differenceInCalendarDays(new Date(), startedAt) + 1

  const phase = client.current_phase || 'foundation'
  const executionScore = Number(client.execution_score || 0)

  const { data: completedLessons } = await supabase
    .from('client_lesson_progress')
    .select('lesson_id')
    .eq('client_id', client.client_id)
    .eq('completed', true)

  const completedIds =
    completedLessons?.map((row: any) => row.lesson_id) || []

  let query = supabase
    .from('education_lessons')
    .select('*')
    .eq('active', true)
    .lte('unlock_day', daysInProgram)
    .lte('min_execution_score', executionScore)
    .or(`phase.eq.${phase},phase.is.null`)
    .order('unlock_day', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(10)

  if (completedIds.length) {
    query = query.not(
      'id',
      'in',
      `(${completedIds.join(',')})`
    )
  }

  const { data: lessons, error } = await query

  if (error) {
    console.error('LESSON LOOKUP ERROR:', error)
    return null
  }

  const lesson = lessons?.[0] || null

  if (!lesson) return null

  await supabase
    .from('client_lesson_progress')
    .upsert({
      client_id: client.client_id,
      auth_user_id: user.id,
      lesson_id: lesson.id,
      viewed: true,
      viewed_at: new Date().toISOString(),
    })

  return {
    ...lesson,
    daysInProgram,
    executionScore,
  }
}
