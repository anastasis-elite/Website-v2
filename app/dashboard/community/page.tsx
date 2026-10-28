import CommunityFeed from './components/CommunityFeed'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'

export default async function CommunityPage() {
  await getDashboardContext()
  return <CommunityFeed />
}
