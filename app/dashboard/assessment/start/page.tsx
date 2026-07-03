import StartContent from './StartContent'
import { getClientData } from '@/lib/supabase/getClient'

export default async function Page({ searchParams }: { searchParams: { assessmentType?: string } }) {
  const client = await getClientData()

  if (!client) {
    return null
  }

  return <StartContent client={client} assessmentType={searchParams.assessmentType === 'monthly' ? 'monthly' : 'initial'} />
}
