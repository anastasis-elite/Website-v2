import { redirect } from 'next/navigation'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'

export default async function WorkoutRedirectPage() {
  const { client } = await getDashboardContext()

  const program = client.program || 'ignite'

  redirect(`/dashboard/program/${encodeURIComponent(program)}/workout`)
}
