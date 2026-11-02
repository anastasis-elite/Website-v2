import { redirect } from 'next/navigation'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import { membershipCan } from '@/lib/membership/policy'
import { getClientTimeZone } from '@/lib/timezone'
import MembershipExperienceFeedback from '@/components/membership/MembershipExperienceFeedback'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'

export default async function ExperiencePage() {
  const { client } = await getDashboardContext({ allowInactiveAccess: true, allowIncompleteOnboarding: true })
  if (!membershipCan(client, 'accountData')) redirect('/dashboard/account')
  return <PhoneAppFrame eyebrow="Membership experience" title="How is your membership going?" subtitle="Share a check-in whenever it’s available.">
    <MembershipExperienceFeedback key={client.client_id} clientId={client.client_id} timeZone={getClientTimeZone(client)} />
  </PhoneAppFrame>
}
