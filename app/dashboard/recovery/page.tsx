import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getProgramLogicForClient } from '@/lib/dashboard/logic/getProgramLogicForClient'
import RecoveryDashboardClient from '@/components/recovery/RecoveryDashboardClient'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'

export default async function RecoveryPage() {
  const { client, supabase, user } = await getDashboardContext()
  await getProgramLogicForClient({supabase,user,client})

  return (
    <PhoneAppFrame eyebrow="Recovery" title="A little room to restore." subtitle="Choose what feels right today."><RecoveryDashboardClient
      clientId={client.client_id}
    /></PhoneAppFrame>
  )
}
