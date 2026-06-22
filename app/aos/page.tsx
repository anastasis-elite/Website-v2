import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'

export default function AOSCommandCenterPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Anastasis Operating System</p>

        <h1 style={styles.heroTitleStyle}>
          Command Center
        </h1>

        <p style={styles.heroTextStyle}>
          A centralized view of clients, systems, operations, content,
          revenue, support needs, and platform health.
        </p>

        {/* TODAY'S FOCUS */}

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>Today's Priority</p>

          <h2 style={styles.h2Style}>
            No active priorities detected.
          </h2>

          <p style={styles.bodyStyle}>
            Future versions of AOS will automatically surface the highest
            leverage action for the business.
          </p>
        </section>

        {/* BUSINESS HEALTH */}

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>Business Health</p>

          <div style={styles.cardGridStyle}>
            {[
              ['New Audits', '0'],
              ['New Clients', '0'],
              ['Pending Onboarding', '0'],
              ['Active Clients', '0'],
              ['Open Tasks', '0'],
              ['Problem Reports', '0'],
            ].map(([label, value]) => (
              <div key={label} style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>{value}</h3>
                <p style={styles.cardTextStyle}>{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* OPERATIONS */}

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>Operations</p>

          <div style={styles.cardGridStyle}>
            <Link
              href="/aos/audits"
              style={{ textDecoration: 'none' }}
            >
              <div style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>Audits</h3>
                <p style={styles.cardTextStyle}>
                  Review Capacity Audit submissions and recommendations.
                </p>
              </div>
            </Link>

            <Link
              href="/aos/clients"
              style={{ textDecoration: 'none' }}
            >
              <div style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>Clients</h3>
                <p style={styles.cardTextStyle}>
                  View client profiles, onboarding status, and progress.
                </p>
              </div>
            </Link>

            <Link
              href="/aos/tasks"
              style={{ textDecoration: 'none' }}
            >
              <div style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>Tasks</h3>
                <p style={styles.cardTextStyle}>
                  Internal action items and operational priorities.
                </p>
              </div>
            </Link>

            <Link
              href="/aos/reports"
              style={{ textDecoration: 'none' }}
            >
              <div style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>Reports</h3>
                <p style={styles.cardTextStyle}>
                  Client issues, bugs, support requests, and system alerts.
                </p>
              </div>
            </Link>
          </div>
        </section>

        {/* SYSTEMS */}

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>Systems</p>

          <div style={styles.cardGridStyle}>
            <Link
              href="/aos/content"
              style={{ textDecoration: 'none' }}
            >
              <div style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>Content</h3>
                <p style={styles.cardTextStyle}>
                  Social content, email sequences, educational resources,
                  and guides.
                </p>
              </div>
            </Link>

            <Link
              href="/aos/programs"
              style={{ textDecoration: 'none' }}
            >
              <div style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>Programs</h3>
                <p style={styles.cardTextStyle}>
                  Ember, Ignite, Phoenix, assessments, onboarding,
                  and delivery systems.
                </p>
              </div>
            </Link>

            <Link
              href="/aos/bots"
              style={{ textDecoration: 'none' }}
            >
              <div style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>Bots</h3>
                <p style={styles.cardTextStyle}>
                  Automation systems, workflows, and future AI employees.
                </p>
              </div>
            </Link>

            <Link
              href="/aos/settings"
              style={{ textDecoration: 'none' }}
            >
              <div style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>Settings</h3>
                <p style={styles.cardTextStyle}>
                  Platform configuration, integrations, permissions,
                  and environment controls.
                </p>
              </div>
            </Link>
          </div>
        </section>

        {/* RECENT ACTIVITY */}

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>Recent Activity</p>

          <div
            style={{
              display: 'grid',
              gap: '12px',
            }}
          >
            <div style={styles.compactCardStyle}>
              <p style={styles.compactCardTextStyle}>
                No activity recorded yet.
              </p>
            </div>
          </div>
        </section>

        {/* FUTURE GENERAL MANAGER */}

        <section style={styles.cartBoxStyle}>
          <p style={styles.eyebrowStyle}>General Manager</p>

          <h2 style={styles.h2Style}>
            Awaiting operational data.
          </h2>

          <p style={styles.bodyStyle}>
            Future versions of AOS will analyze audits, clients,
            onboarding, support requests, nutrition compliance,
            workout adherence, content performance, and business
            operations to recommend the highest leverage next action.
          </p>
        </section>
      </div>
    </main>
  )
}
