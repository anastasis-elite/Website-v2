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
      <div className="dashboard-menu">
        <details>
          <summary>◌</summary>

          <div className="dashboard-dropdown">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/dashboard/program">Program</Link>
            <Link href="/dashboard/nutrition">Nutrition</Link>
            <Link href="/dashboard/assessment/start">
              Assessments
            </Link>
          </div>
        </details>
      </div>

      {children}
    </>
  )
}
