import { redirect } from 'next/navigation'

export default async function PlanRedirect() {
  redirect('/dashboard/program/ignite')
}
