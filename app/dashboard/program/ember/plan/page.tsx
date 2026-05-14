import { redirect } from 'next/navigation'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'

export default async function PlanPage() {
  const { client } = await getDashboardContext()

  if (!client?.program) {
    redirect('/dashboard')
  }

  redirect(`/dashboard/program/${client.program}/plan/content`)
}
