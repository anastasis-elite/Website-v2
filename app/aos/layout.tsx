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
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    console.error('AOS USER ERROR:', userError)
  }

  if (!user?.email) {
    console.error('AOS BLOCKED: No user session found')
    return (
  <main style={styles.pageStyle}>
    <div style={styles.containerStyle}>
      <p style={styles.eyebrowStyle}>AOS Debug</p>
      <h1 style={styles.heroTitleStyle}>Access blocked</h1>
      <p style={styles.bodyStyle}>
        Reason: No user session or admin permission found.
      </p>
      <p style={styles.bodyStyle}>
        User email: {user?.email || 'No user found'}
      </p>
    </div>
  </main>
)
  }

  const adminEmail = user.email.trim().toLowerCase()

  const { data: admin, error: adminError } = await supabase
    .from('aos_admins')
    .select('id, role, active, email')
    .eq('email', adminEmail)
    .eq('active', true)
    .maybeSingle()

  if (adminError) {
    console.error('AOS ADMIN ERROR:', adminError)
  }

  if (!admin) {
    console.error('AOS BLOCKED: User not in aos_admins:', adminEmail)
    redirect('/aos-login')
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
