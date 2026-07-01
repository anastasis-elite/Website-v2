import { redirect } from 'next/navigation'
import AOSNavigation from '@/components/AOSNavigation'
import * as styles from '@/app/styles/globalstyles'
import { createClient } from '@/lib/supabase/server'
import { isAOSAdmin } from '@/lib/aos/isAOSAdmin'

export default async function AOSLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!isAOSAdmin(user?.email)) {
    redirect('/aos-login')
  }

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <div style={{ marginBottom: '56px' }}>
          <p style={styles.eyebrowStyle}>Anastasis Operating System</p>
          <h1 style={styles.heroTitleStyle}>AOS</h1>
          <p style={styles.heroTextStyle}>
            Internal command center.
          </p>
          <p style={{ color: '#fff' }}>
  Logged in as: {user?.email}
</p>
          <AOSNavigation />
        </div>

        {children}
      </div>
    </main>
  )
}
