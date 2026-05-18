import Link from 'next/link'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await getDashboardContext()

  return (
    <>
      <div className="dashboard-home-button">
        <Link href="/dashboard" className="button secondary">
          Dashboard
        </Link>
      </div>

      {children}
    </>
  )
}
