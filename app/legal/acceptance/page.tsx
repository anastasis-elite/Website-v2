import { redirect } from 'next/navigation'
import * as styles from '@/app/styles/globalstyles'
import { createClient } from '@/lib/supabase/server'
import { hasCurrentLegalAcceptance } from '@/lib/legal/hasCurrentLegalAcceptance'
import LegalAcceptanceForm from '@/components/legal/LegalAcceptanceForm'
import { EFFECTIVE_DATE } from '@/lib/legal/config'

export default async function LegalAcceptancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/legal/acceptance')
  if (process.env.LEGAL_GATE_ENABLED === 'true' && await hasCurrentLegalAcceptance(supabase, user.id)) redirect('/dashboard')

  return <main style={styles.pageStyle}><div style={{ ...styles.containerStyle, maxWidth: '820px' }}>
    <p style={styles.eyebrowStyle}>Required Before Dashboard Access</p>
    <h1 style={styles.heroTitleStyle}>Review how Anastasis works.</h1>
    <p style={styles.heroTextStyle}>Required acknowledgments protect informed participation. Optional research consent remains separate.</p>
    <LegalAcceptanceForm />
  </div></main>
}
