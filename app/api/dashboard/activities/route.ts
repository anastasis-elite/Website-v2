import { NextResponse } from 'next/server'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { dashboardApiError } from '@/lib/dashboard/apiError'
import { invalidateDailyPlan } from '@/lib/dashboard/invalidateDailyPlan'
import { getProgramLogicForClient } from '@/lib/dashboard/logic/getProgramLogicForClient'
import { buildTodayActivities, readDailyGuide, TODAY_ACTIVITY_IDS, type TodayActivityId } from '@/lib/dashboard/todayActivities'
import { getDailyScheduleState } from '@/lib/schedule/service'
import { getClientDayRange } from '@/lib/schedule/time'
import { getClientLocalDate } from '@/lib/timezone'

const actions = new Set(['defer', 'skip', 'resume', 'review'])

export async function POST(request: Request) {
  try {
    let body: any
    try { body = await request.json() } catch { return NextResponse.json({ error: 'Choose an activity and try again.' }, { status: 400 }) }
    if (!body || !TODAY_ACTIVITY_IDS.includes(body.activityId) || !actions.has(body.action) || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return NextResponse.json({ error: 'Choose a valid activity and action.' }, { status: 400 })
    }
    if (body.action === 'review' && body.activityId !== 'schedule') {
      return NextResponse.json({ error: 'Save this activity through its own page to record completion.' }, { status: 400 })
    }
    const { supabase, user, client: member } = await getDashboardContext()
    const activityId = body.activityId as TodayActivityId
    // A compare-and-swap preserves unrelated profile fields and concurrent
    // activity choices. A missed comparison reloads the current row and retries.
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: client, error: readError } = await supabase.from('clients').select('*')
        .eq('client_id', member.client_id).eq('auth_user_id', user.id).maybeSingle()
      if (readError) throw new Error(readError.message)
      if (!client) return NextResponse.json({ error: 'Member profile not found.' }, { status: 404 })
      const day = getClientDayRange(client)
      if (body.date !== day.date) return NextResponse.json({ error: 'A new day has started. Refresh Today before saving this choice.' }, { status: 409 })
      const effectiveClient = { ...client, ...member, onboarding_data: client.onboarding_data, timezone: client.timezone,
        execution_style: client.execution_style, carousel_style: client.carousel_style }
      const logic = await getProgramLogicForClient({ supabase, user, client: effectiveClient })
      const schedule = await getDailyScheduleState({ supabase, user, client: effectiveClient, logic })
      const activity = buildTodayActivities(logic, schedule).activities.find(item => item.id === activityId)
      if (!activity) return NextResponse.json({ error: 'This activity is not in today’s plan.' }, { status: 409 })
      if (body.action !== 'resume' && activity.status === 'completed' && !(activityId === 'schedule' && body.action === 'review')) {
        return NextResponse.json({ error: 'Your saved activity is already complete.' }, { status: 409 })
      }
      if (body.action === 'skip' && !activity.canSkip) return NextResponse.json({ error: 'This activity can be returned to later, but cannot be skipped.' }, { status: 409 })
      if (body.action === 'defer' && !activity.canDefer) return NextResponse.json({ error: 'Review the available guidance before continuing.' }, { status: 409 })
      if (body.action === 'resume' && ['deferred', 'skipped'].includes(activity.status) && !activity.canResume) {
        return NextResponse.json({ error: 'This activity’s time is saved in Schedule. Review it there.' }, { status: 409 })
      }
      const dailyGuide = readDailyGuide(client.onboarding_data?.dailyGuide, day.date)
      if (body.action === 'resume') delete dailyGuide.activities[activityId]
      else if (body.action === 'review') dailyGuide.activities.schedule = { status: 'reviewed' }
      else if (body.action === 'skip') dailyGuide.activities[activityId] = { status: 'skipped' }
      else {
        const previous = dailyGuide.activities[activityId]
        dailyGuide.activities[activityId] = previous?.status === 'deferred' && Date.parse(previous.until!) > Date.now()
          ? previous : { status: 'deferred', until: new Date(Math.min(Date.now() + 60 * 60000, day.end.getTime() - 1)).toISOString() }
      }
      const original = client.onboarding_data
      if (original != null && (typeof original !== 'object' || Array.isArray(original))) return NextResponse.json({ error: 'Your saved preferences could not be loaded. Try again.' }, { status: 409 })
      const onboardingData = original && typeof original === 'object' && !Array.isArray(original) ? original : {}
      if (getClientLocalDate(client) !== day.date) return NextResponse.json({ error: 'A new day has started. Refresh Today before saving this choice.' }, { status: 409 })
      let update = supabase.from('clients').update({ onboarding_data: { ...onboardingData, dailyGuide } })
        .eq('client_id', member.client_id).eq('auth_user_id', user.id)
      update = original == null ? update.is('onboarding_data', null) : update.eq('onboarding_data', JSON.stringify(original))
      const { data: saved, error: saveError } = await update.select('client_id').maybeSingle()
      if (saveError) throw new Error(saveError.message)
      if (!saved) continue
      invalidateDailyPlan()
      return NextResponse.json({ success: true, date: day.date, activityId, action: body.action, dailyGuide })
    }
    return NextResponse.json({ error: 'Another change was saved at the same time. Try your choice again.' }, { status: 409 })
  } catch (error) {
    const digest = typeof error === 'object' && error !== null && 'digest' in error ? String(error.digest) : ''
    return digest.startsWith('NEXT_REDIRECT;') ? dashboardApiError(error, 'Your activity choice could not be saved. Try again.')
      : NextResponse.json({ error: 'Your activity choice could not be saved. Try again.' }, { status: 500 })
  }
}
