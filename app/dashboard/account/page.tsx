import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getAccountData } from '@/lib/dashboard/account/getAccountData'
import AccountDashboard from '@/components/account/AccountDashboard'

export default async function AccountPage() {
  const { client, user, supabase } = await getDashboardContext()
  const data = await getAccountData({ client, user, supabase })
  const profileFormData = {
    full_name: client.full_name || null,
    email: client.email || client.login_email || user.email || null,
    birthdate: client.birthdate || null,
    birthdate_updated_once: Boolean(client.birthdate_updated_once),
    address_line_1: client.address_line_1 || null,
    address_line_2: client.address_line_2 || null,
    city: client.city || null,
    state: client.state || null,
    postal_code: client.postal_code || null,
    country: client.country || null,
    reproductive_status: client.reproductive_status || null,
    last_period_start: client.last_period_start || null,
    average_cycle_length: client.average_cycle_length || null,
    injuries: client.injuries || [],
    limitations: client.limitations || [],
    equipment_access: client.equipment_access || [],
    current_weight: client.current_weight || null,
    primary_goal: client.primary_goal || null,
    workout_days_available: client.workout_days_available || null,
    current_workout_minutes_per_session: client.current_workout_minutes_per_session || null,
  }
  return <AccountDashboard initialData={data} client={profileFormData} user={{ email: user.email || null }} />
}
