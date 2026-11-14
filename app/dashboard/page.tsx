import { redirect } from 'next/navigation'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { parseMembershipTier } from '@/lib/membership/policy'
import ProgramDashboardPage from '@/components/program-dashboard/ProgramDashboardPage'

const supportedPrograms = ['ember', 'ignite', 'phoenix']

export default async function DashboardPage() {
  const { client } = await getDashboardContext()
  const tier = parseMembershipTier(client.program)
  if (tier === 'free') redirect('/dashboard/community')
  if (tier === 'tracker') redirect('/dashboard/tracker')
  if (!tier) redirect('/dashboard/account')
  const program = supportedPrograms.includes(client.program)
    ? client.program
    : tier

  // Render the verified member's Today in this request. The shared renderer
  // still applies its legal and safety gates; identity is shared only within
  // this server render through getDashboardContext's React cache.
  return <ProgramDashboardPage params={Promise.resolve({ program })} />
}
