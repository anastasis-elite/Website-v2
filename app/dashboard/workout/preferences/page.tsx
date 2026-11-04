import Link from 'next/link'
import { notFound } from 'next/navigation'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import WeekdayMusclePreferencesForm from '@/components/workout-dashboard/WeekdayMusclePreferencesForm'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { membershipCan } from '@/lib/membership/policy'
import { normalizeProgramTier } from '@/lib/entitlements'
import { readWeekdayMusclePreferenceContext } from '@/lib/program/saveWeekdayMusclePreferences'

export const dynamic = 'force-dynamic'

export default async function WorkoutWeekdayPreferencesPage() {
  const { supabase, user, client } = await getDashboardContext()
  if (!user?.id || client?.auth_user_id !== user.id || !membershipCan(client, 'generatedCoaching') || !membershipCan(client, 'workoutDisplay')) notFound()
  const program = normalizeProgramTier(client.program)
  const context = await readWeekdayMusclePreferenceContext({ supabase, user })
  if (!context.ok && [401, 403, 404].includes(context.status)) notFound()
  return <PhoneAppFrame backHref={`/dashboard/program/${program}/workout`} backLabel="Workout" eyebrow="Your training week" title="Training day preferences" subtitle="Choose when to use the work already in your prescribed plan.">
    {context.ok ? <WeekdayMusclePreferencesForm key={`${context.user.id}:${context.client.client_id}:${context.view.today}:${context.view.revision}`}
      clientId={context.client.client_id} userId={context.user.id} initialView={context.view} initialFocusPlans={context.focusPlans} sourceStatus={context.sourceStatus} />
      : <section className="phone-app-card"><p role="status">Your saved preferences could not be loaded. Your current workout and prior choices have been kept.</p><Link href="/dashboard/workout/preferences" className="tier-secondary-action" prefetch={false}>Retry preferences</Link></section>}
  </PhoneAppFrame>
}
