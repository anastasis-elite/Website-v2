import StartContent from './StartContent'
import { getClientData } from '@/lib/supabase/getClient'

export default async function Page({ searchParams }: { searchParams: Promise<{ assessmentType?: string }> }) {
  const query = await searchParams
  const client = await getClientData()

  if (!client) {
    return null
  }

  return <StartContent client={client} assessmentType={query.assessmentType === 'monthly' ? 'monthly' : 'initial'} />
}
