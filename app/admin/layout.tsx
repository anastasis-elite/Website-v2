import { redirect } from 'next/navigation'
import { getAOSAdminUser } from '@/lib/aos/getAOSAdminUser'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAOSAdminUser()
  if (!admin) redirect('/aos-login?redirect=/admin/gift-client')
  return children
}
