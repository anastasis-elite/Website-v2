import { notFound } from 'next/navigation'
import * as styles from '@/app/styles/globalstyles'
import { createClient } from '@/lib/supabase/server'

export default async function AOSClientDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!client) {
    notFound()
  }

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>AOS Client File</p>

        <h1 style={styles.heroTitleStyle}>
          {client.full_name || client.email || 'Unnamed Client'}
        </h1>

        <p style={styles.heroTextStyle}>
          Client profile, onboarding status, program placement, and system data.
        </p>

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>Client Summary</p>

          <div style={styles.cardGridStyle}>
            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Email</h3>
              <p style={styles.cardTextStyle}>{client.email || 'N/A'}</p>
            </div>

            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Program</h3>
              <p style={styles.cardTextStyle}>
                {client.program || 'Not assigned'}
              </p>
            </div>

            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Onboarding</h3>
              <p style={styles.cardTextStyle}>
                {client.onboarding_complete ? 'Complete' : 'Pending'}
              </p>
            </div>

            <div style={styles.cardStyle}>
              <h3 style={styles.cardTitleStyle}>Created</h3>
              <p style={styles.cardTextStyle}>
                {client.created_at
                  ? new Date(client.created_at).toLocaleDateString()
                  : 'N/A'}
              </p>
            </div>
          </div>
        </section>

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>Profile Details</p>

          <div style={{ display: 'grid', gap: '12px' }}>
            <p style={styles.bodyStyle}>
              <strong>Birthdate:</strong> {client.birthdate || 'N/A'}
            </p>

            <p style={styles.bodyStyle}>
              <strong>Phone:</strong> {client.phone || 'N/A'}
            </p>

            <p style={styles.bodyStyle}>
              <strong>Reproductive Status:</strong>{' '}
              {client.reproductive_status || 'N/A'}
            </p>

            <p style={styles.bodyStyle}>
              <strong>Last Period Start:</strong>{' '}
              {client.last_period_start || 'N/A'}
            </p>

            <p style={styles.bodyStyle}>
              <strong>Average Cycle Length:</strong>{' '}
              {client.average_cycle_length || 'N/A'}
            </p>
          </div>
        </section>

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>Address</p>

          <p style={styles.bodyStyle}>
            {client.address_line_1 || ''}
            {client.address_line_2 ? `, ${client.address_line_2}` : ''}
            <br />
            {client.city || ''}
            {client.state ? `, ${client.state}` : ''}{' '}
            {client.postal_code || ''}
            <br />
            {client.country || ''}
          </p>
        </section>

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>Raw Client Data</p>

          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '0.85rem',
              lineHeight: 1.6,
              color: '#d7c7b6',
              background: 'rgba(255,255,255,0.025)',
              borderRadius: '22px',
              padding: '22px',
              overflowX: 'auto',
            }}
          >
            {JSON.stringify(client, null, 2)}
          </pre>
        </section>
      </div>
    </main>
  )
}
