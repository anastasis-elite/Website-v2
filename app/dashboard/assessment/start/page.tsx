import StartContent from './StartContent'
import { getClientData } from '@/lib/supabase/getClient'

export default async function Page() {
  const client = await getClientData()

  if (!client) {
    return null
  }

  return <StartContent client={client} />
}
