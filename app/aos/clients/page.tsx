import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'
import { createClient } from '@/lib/supabase/server'
import AOSNavigation from '@/components/AOSNavigation'

export default async function AOSClientsPage() {
  const supabase = await createClient()

  const { data: clients } = await supabase
    .from('clients')
    .select(`
      id,
      full_name,
      email,
      program,
      onboarding_complete,
      created_at
    `)
    .order('created_at', { ascending: false })

  return (
    <>
        <p style={styles.eyebrowStyle}>
          Anastasis Operating System
        </p>

        <h1 style={styles.heroTitleStyle}>
          Clients
        </h1>

        <p style={styles.heroTextStyle}>
          Active clients, onboarding status, and program placement.
        </p>
        
        <section style={styles.cartBoxStyle}>
          {clients?.length ? (
            clients.map((client) => (
              <Link
                key={client.id}
                href={`/aos/clients/${client.id}`}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div
                  style={{
                    padding: '18px',
                    borderBottom:
                      '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <h3 style={styles.cardTitleStyle}>
                    {client.full_name || 'Unnamed Client'}
                  </h3>

                  <p style={styles.bodyStyle}>
                    {client.email}
                  </p>

                  <p style={styles.bodyStyle}>
                    Program:{' '}
                    {client.program || 'Not Assigned'}
                  </p>

                  <p style={styles.bodyStyle}>
                    Onboarding:{' '}
                    {client.onboarding_complete
                      ? 'Complete'
                      : 'Pending'}
                  </p>

                  <p
                    style={{
                      opacity: 0.6,
                      fontSize: '.85rem',
                    }}
                  >
                    {client.created_at
                      ? new Date(
                          client.created_at
                        ).toLocaleDateString()
                      : ''}
                  </p>
                </div>
              </Link>
            ))
          ) : (
            <p style={styles.bodyStyle}>
              No clients found.
            </p>
          )}
        </section>
      </>
  )
}
