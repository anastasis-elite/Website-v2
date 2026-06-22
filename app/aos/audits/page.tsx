import * as styles from '@/app/styles/globalstyles'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import AOSNavigation from '@/components/AOSNavigation'

export default async function AOSAuditsPage() {
  const supabase = await createClient()

  const { data: audits } = await supabase
    .from('applications')
    .select(`
      id,
      full_name,
      email,
      capacity_score,
      recommended_program,
      created_at
    `)
    .order('created_at', { ascending: false })

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>
          Anastasis Operating System
        </p>

        <h1 style={styles.heroTitleStyle}>
          Capacity Audits
        </h1>

        <p style={styles.heroTextStyle}>
          Review audit submissions and recommended program placement.
        </p>

        <AOSNavigation />
        
        <section style={styles.cartBoxStyle}>
          {audits?.length ? (
            audits.map((audit) => (
              <div
                key={audit.id}
                style={{
                  padding: '18px',
                  borderBottom:
                    '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <Link
  href={`/aos/audits/${audit.id}`}
  style={{
    color: 'inherit',
    textDecoration: 'none',
  }}
>
  <h3 style={styles.cardTitleStyle}>
    {audit.full_name}
  </h3>
</Link>

                <p style={styles.bodyStyle}>
                  {audit.email}
                </p>

                <p style={styles.bodyStyle}>
                  Capacity Score:{' '}
                  {audit.capacity_score ?? 'N/A'}
                </p>

                <p style={styles.bodyStyle}>
                  Recommended Program:{' '}
                  {audit.recommended_program}
                </p>

                <p
                  style={{
                    opacity: 0.6,
                    fontSize: '.85rem',
                  }}
                >
                  {audit.created_at
                    ? new Date(
                        audit.created_at
                      ).toLocaleString()
                    : ''}
                </p>
              </div>
            ))
          ) : (
            <p style={styles.bodyStyle}>
              No audits submitted yet.
            </p>
          )}
        </section>
      </div>
    </main>
  )
}
