import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { redirect } from 'next/navigation'
import { hasCurrentLegalAcceptance } from '@/lib/legal/hasCurrentLegalAcceptance'
import DailyPlanRefresh from '@/components/DailyPlanRefresh'
import ClientDashboardNav from '@/components/navigation/ClientDashboardNav'
import { isClientOnboardingComplete } from '@/lib/dashboard/isClientOnboardingComplete'
import { hasMemberAccess } from '@/lib/commerce/access'
import { TutorialProvider } from '@/components/tutorial/TutorialProvider'
import TutorialDevPanel from '@/components/tutorial/TutorialDevPanel'
import TutorialRenderer from '@/components/tutorial/TutorialRenderer'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Billing and support pages share this layout and remain reachable when access ends.
  // Individual member pages and middleware enforce paid access for member content.
  const { supabase, user, client } = await getDashboardContext({ allowIncompleteOnboarding: true, allowInactiveAccess: true })
  const onboardingIncomplete=!isClientOnboardingComplete(client)
  if (hasMemberAccess(client)&&!onboardingIncomplete&&process.env.LEGAL_GATE_ENABLED === 'true') {
    const accepted = await hasCurrentLegalAcceptance(supabase, user.id)
    if (!accepted) redirect('/legal/acceptance')
  }

  const program=(['ember','ignite','phoenix'].includes(client.program)?client.program:'ember') as 'ember'|'ignite'|'phoenix'
  return (
    <TutorialProvider tier={program}>
      <div className="dashboard-client-shell" data-tutorial-id="dashboard-shell">
        <DailyPlanRefresh />
        {children}
        <ClientDashboardNav program={program}/>
        <TutorialRenderer/>
        <TutorialDevPanel/>
      </div>
    </TutorialProvider>
  )
}
