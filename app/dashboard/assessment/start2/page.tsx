import Start2Content from './Start2Content'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { getStrengthFormHistory } from '@/lib/assessment/strengthForm'

export default async function Page() {
  const { client, supabase } = await getDashboardContext({ allowIncompleteOnboarding: true })
  const history = await getStrengthFormHistory(supabase, client)
  return <Start2Content client={client} history={history} />
}
