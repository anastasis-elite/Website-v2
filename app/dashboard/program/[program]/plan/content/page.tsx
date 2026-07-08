import { redirect } from 'next/navigation'

export default async function ProgramPlanContentRedirect({
  params,
}: {
  params: Promise<{ program: string }>
}) {
  const { program } = await params
  redirect(`/dashboard/program/${program}`)
}
