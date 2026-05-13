import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await getDashboardContext()

  return <>{children}</>
}
