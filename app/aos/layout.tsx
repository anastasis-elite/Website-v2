import { redirect } from 'next/navigation'
import AOSNavigation from '@/components/AOSNavigation'
import * as styles from '@/app/styles/globalstyles'
import { createClient } from '@/lib/supabase/server'

export default async function AOSLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    redirect('/login?redirect=/aos')
  }

  const { data: admin } = await supabase
    .from('aos_admins')
    .select('id, role, active')
    .eq('email', user.email)
    .eq('active', true)
    .maybeSingle()

  if (!admin) {
    redirect('/dashboard')
  }

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <div style={{ marginBottom: '56px' }}>
          <p style={styles.eyebrowStyle}>Anastasis Operating System</p>

          <h1 style={styles.heroTitleStyle}>AOS</h1>

          <p style={styles.heroTextStyle}>
            The internal command center for clients, audits, tasks, reports,
            systems, and business operations.
          </p>

          <AOSNavigation />
        </div>

        {children}
      </div>
    </main>
  )
}
