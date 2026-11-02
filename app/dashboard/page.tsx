import { redirect } from 'next/navigation'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { parseMembershipTier } from '@/lib/membership/policy'

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

  redirect(`/dashboard/program/${program}`)
}
