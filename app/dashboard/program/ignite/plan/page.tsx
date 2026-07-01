import { redirect } from 'next/navigation'

export default async function PlanRedirect({
  params,
}: {
  params: { program: string }
}) {
  redirect(`/dashboard/program/${params.program}`)
}
