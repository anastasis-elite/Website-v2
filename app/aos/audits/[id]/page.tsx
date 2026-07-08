import { notFound } from 'next/navigation'
import * as styles from '@/app/styles/globalstyles'
import { createClient } from '@/lib/supabase/server'
import AOSNavigation from '@/components/AOSNavigation'

export default async function AuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: audit } = await supabase
    .from('applications')
    .select('*')
    .eq('id', id)
    .single()

  if (!audit) {
    notFound()
  }

  const applicationData = audit.application_data || {}

  return (
    <>
        <p style={styles.eyebrowStyle}>
          Capacity Audit
        </p>

        <h1 style={styles.heroTitleStyle}>
          {audit.full_name || 'Unnamed Applicant'}
        </h1>

        <p style={styles.heroTextStyle}>
          Audit review and recommendation details.
        </p>
        
        {/* SUMMARY */}

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.h2Style}>
            Summary
          </h2>

          <div style={styles.cardGridStyle}>
            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>
                Capacity Score
              </h3>

              <p style={styles.cardTextStyle}>
                {audit.capacity_score ?? 'N/A'}
              </p>
            </div>

            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>
                Recommended Program
              </h3>

              <p style={styles.cardTextStyle}>
                {audit.recommended_program ?? 'N/A'}
              </p>
            </div>

            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>
                Status
              </h3>

              <p style={styles.cardTextStyle}>
                {audit.status ?? 'new'}
              </p>
            </div>

            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>
                Submitted
              </h3>

              <p style={styles.cardTextStyle}>
                {audit.created_at
                  ? new Date(audit.created_at).toLocaleDateString()
                  : ''}
              </p>
            </div>
          </div>
        </section>

        {/* CONTACT */}

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.h2Style}>
            Contact Information
          </h2>

          <p style={styles.bodyStyle}>
            <strong>Name:</strong>{' '}
            {audit.full_name}
          </p>

          <p style={styles.bodyStyle}>
            <strong>Email:</strong>{' '}
            {audit.email}
          </p>
        </section>

        {/* AUDIT RESPONSES */}

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.h2Style}>
            Audit Responses
          </h2>

          <div
            style={{
              display: 'grid',
              gap: '16px',
            }}
          >
            {Object.entries(applicationData).map(
              ([key, value]) => (
                <div
                  key={key}
                  style={styles.compactCardStyle}
                >
                  <h3 style={styles.compactCardTitleStyle}>
                    {key}
                  </h3>

                  <p style={styles.compactCardTextStyle}>
                    {String(value)}
                  </p>
                </div>
              )
            )}
          </div>
        </section>

        {/* FUTURE ACTIONS */}

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.h2Style}>
            Recommended Action
          </h2>

          <p style={styles.bodyStyle}>
            Future AOS versions will generate
            follow-up actions automatically.
          </p>
        </section>
      </>
  )
}
