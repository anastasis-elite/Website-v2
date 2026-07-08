import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { redirect } from 'next/navigation'
import { hasCurrentLegalAcceptance } from '@/lib/legal/hasCurrentLegalAcceptance'
import ClientDashboardNav from '@/components/navigation/ClientDashboardNav'
import { isClientOnboardingComplete } from '@/lib/dashboard/isClientOnboardingComplete'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { supabase, user, client } = await getDashboardContext({ allowIncompleteOnboarding: true })
  const onboardingIncomplete=!isClientOnboardingComplete(client)
  if (!onboardingIncomplete&&process.env.LEGAL_GATE_ENABLED === 'true') {
    const accepted = await hasCurrentLegalAcceptance(supabase, user.id)
    if (!accepted) redirect('/legal/acceptance')
  }

  const program=(['ember','ignite','phoenix'].includes(client.program)?client.program:'ignite') as 'ember'|'ignite'|'phoenix'
  return <div className="dashboard-client-shell">{children}<ClientDashboardNav program={program}/></div>
}
