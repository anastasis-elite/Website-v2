import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'
import { createClient } from '@/lib/supabase/server'
import AOSNavigation from '@/components/AOSNavigation'

export default async function AOSTasksPage() {
  const supabase = await createClient()

  const { data: tasks } = await supabase
    .from('admin_tasks')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>AOS</p>

        <h1 style={styles.heroTitleStyle}>Tasks</h1>

        <p style={styles.heroTextStyle}>
          Internal priorities, system actions, client follow-ups, and future bot-generated recommendations.
        </p>

        <AOSNavigation />
        
        <section style={styles.cartBoxStyle}>
          <div style={styles.buttonRowStyle}>
            <Link href="/aos" style={styles.secondaryButtonStyle}>
              Command Center
            </Link>

            <Link href="/aos/tasks/new" style={styles.primaryButtonStyle}>
              Create Task
            </Link>
          </div>
        </section>

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>Open Tasks</p>

          {tasks?.length ? (
            <div style={{ display: 'grid', gap: '14px' }}>
              {tasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/aos/tasks/${task.id}`}
                  style={{ color: 'inherit', textDecoration: 'none' }}
                >
                  <div style={styles.compactCardStyle}>
                    <h3 style={styles.compactCardTitleStyle}>
                      {task.title || 'Untitled Task'}
                    </h3>

                    <p style={styles.compactCardTextStyle}>
                      Status: {task.status || 'open'} · Priority:{' '}
                      {task.priority || 'normal'}
                    </p>

                    {task.description ? (
                      <p style={styles.compactCardTextStyle}>
                        {task.description}
                      </p>
                    ) : null}

                    <p style={{ ...styles.compactCardTextStyle, opacity: 0.6 }}>
                      {task.created_at
                        ? new Date(task.created_at).toLocaleString()
                        : ''}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p style={styles.bodyStyle}>No tasks yet.</p>
          )}
        </section>
      </div>
    </main>
  )
}
