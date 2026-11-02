import { redirect } from 'next/navigation'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { membershipCan } from '@/lib/membership/policy'
import { getClientTimeZone } from '@/lib/timezone'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import ManualWorkoutBuilder from '@/components/workout-dashboard/ManualWorkoutBuilder'
import RecoveryLogger from '@/components/RecoveryLogger'
import RecoveryActivitySheets from '@/components/recovery/RecoveryActivitySheets'
import TrackerIntake from '@/components/tracker/TrackerIntake'

export default async function TrackerPage() {
  const { client, user } = await getDashboardContext({ allowIncompleteOnboarding: true })
  if (client.program !== 'tracker') redirect('/dashboard')
  if (!membershipCan(client, 'workoutLogging')) redirect('/dashboard/payment-issue')
  return <PhoneAppFrame eyebrow="Tracker" title="Your activity, recorded." subtitle="Keep a record of what you do.">
    <ManualWorkoutBuilder clientId={client.client_id} authUserId={user.id} program="tracker" timezone={getClientTimeZone(client)}
      weightUnit={client.weight_unit === 'kg' || client.unit_preference === 'metric' ? 'kg' : 'lb'}
      recommendedDayName="Manual Workout" recommendedExercises={[]} memberEquipment={Array.isArray(client.equipment_access) ? client.equipment_access : []}
      readiness={[]} trackingOnly />
    <TrackerIntake clientId={client.client_id} />
    <h2>Recovery tracking</h2>
    <div className="phone-app-grid"><RecoveryActivitySheets clientId={client.client_id} /></div>
    <RecoveryLogger clientId={client.client_id} />
  </PhoneAppFrame>
}
