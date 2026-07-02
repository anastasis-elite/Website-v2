import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { redirect } from 'next/navigation'
import { hasCurrentLegalAcceptance } from '@/lib/legal/hasCurrentLegalAcceptance'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { supabase, user } = await getDashboardContext({ allowIncompleteOnboarding: true })
  if (process.env.LEGAL_GATE_ENABLED === 'true') {
    const accepted = await hasCurrentLegalAcceptance(supabase, user.id)
    if (!accepted) redirect('/legal/acceptance')
  }

  return <>{children}</>
}
