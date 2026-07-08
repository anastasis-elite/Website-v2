import { redirect } from 'next/navigation'

export default async function PlanRedirect({
  params,
}: {
  params: Promise<{ program: string }>
}) {
  const { program } = await params
  redirect(`/dashboard/program/${program}`)
}
