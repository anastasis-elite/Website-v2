import { redirect } from 'next/navigation'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'

const supportedPrograms = ['ember', 'ignite', 'phoenix']

export default async function DashboardPage() {
  const { client } = await getDashboardContext()
  const program = supportedPrograms.includes(client.program)
    ? client.program
    : 'ignite'

  redirect(`/dashboard/program/${program}`)
}
