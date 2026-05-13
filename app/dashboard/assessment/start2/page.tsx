import Start2Content from './Start2Content'
import { getClientData } from '@/lib/supabase/getClient'

export default async function Page() {
  const client = await getClientData()

  if (!client) {
    return null
  }

  return <Start2Content client={client} />
}
