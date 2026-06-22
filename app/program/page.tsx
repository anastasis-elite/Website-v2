import * as styles from '../styles/globalstyles'

const paths = [
  {
    name: 'Ember',
    headline: 'Rebuild Consistency',
    tagline:
      'For the woman who knows what she wants, but needs a sustainable structure she can actually follow.',
    body:
      'You are capable. You are motivated. You are simply carrying a lot. Ember helps you establish rhythm, rebuild trust in yourself, and create consistency without relying on perfection.',
    includes: [
      'Adaptive training structure',
      'Nutrition guidance',
      'Recovery recommendations',
      'Progress tracking',
      'Cycle awareness',
      'Foundational assessments',
    ],
    bestFor: 'Women who need clarity, structure, and momentum.',
    href: '/program/ember',
  },
  {
    name: 'Ignite',
    headline: 'Optimize What Is Working',
    tagline:
      'For the woman who has built some consistency and is ready to refine the details.',
    body:
      'Ignite creates greater precision around training, nutrition, recovery, and performance while still adapting to the realities of your actual life.',
    includes: [
      'Everything in Ember',
      'Advanced nutrition support',
      'Deeper tracking',
      'More personalized adjustments',
      'Greater visibility into progress',
      'More refined training and recovery guidance',
    ],
    bestFor: 'Women who want to optimize rather than simply maintain.',
    href: '/program/ignite',
  },
  {
    name: 'Phoenix',
    headline: 'Remove Friction',
    tagline:
      'For the woman carrying the greatest load who wants the highest level of support.',
    body:
      'Phoenix is designed to reduce decision fatigue, increase personalization, and make execution as simple as possible so your energy can go toward your life, not constantly figuring out what to do next.',
    includes: [
      'Everything in Ignite',
      'Food photo guidance',
      'Personalized insights',
      'Posture and compensation assessment',
      'Meal recommendations',
      'Highest level of support',
    ],
    bestFor: 'Women who want the most guidance with the fewest obstacles.',
    href: '/program/phoenix',
  },
]

export default function ProgramPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={{ ...styles.containerStyle, maxWidth: '1120px' }}>

        <section style={{ marginBottom: '110px', textAlign: 'center' }}>
          <p style={styles.eyebrowStyle}>Choose Your Path</p>

          <h1
            style={{
              ...styles.heroTitleStyle,
              maxWidth: '980px',
              margin: '0 auto 28px auto',
            }}
          >
            Find the starting point that fits your life right now.
          </h1>

          <p
            style={{
              ...styles.heroTextStyle,
              maxWidth: '820px',
              margin: '0 auto 42px auto',
            }}
          >
            Anastasis is designed to meet you where you are and grow with you as
            your capacity expands. Whether you are rebuilding consistency,
            optimizing what is already working, or removing as much friction as
            possible, there is a path designed for your current season.
          </p>

          <div style={{ ...styles.buttonRowStyle, justifyContent: 'center' }}>
            <a href="#paths" style={styles.primaryButtonStyle}>
              Explore the Paths
            </a>

            <a href="/audit" style={styles.secondaryButtonStyle}>
              Help Me Find Mine
            </a>
          </div>
        </section>

        <section style={{ marginBottom: '120px', textAlign: 'center' }}>
          <p style={styles.eyebrowStyle}>One Destination. Three Starting Points.</p>

          <h2
            style={{
              ...styles.heroTitleStyle,
              fontSize: 'clamp(2rem, 4vw, 3.6rem)',
              maxWidth: '900px',
              margin: '0 auto 34px auto',
            }}
          >
            The goal is not to push harder forever.
            <br />
            The goal is expanded capacity.
          </h2>

          <p
            style={{
              ...styles.heroTextStyle,
              maxWidth: '780px',
              margin: '0 auto 56px auto',
            }}
          >
            Every Anastasis path is built to help you train, eat, recover, and
            rebuild in a way your life can actually sustain. The difference is
            the amount of structure, guidance, personalization, and support
            provided along the way.
          </p>

          <div style={styles.cardGridStyle}>
            {[
              'Build strength',
              'Improve energy',
              'Support recovery',
              'Reduce overwhelm',
              'Expand capacity',
              'Create sustainable consistency',
            ].map((item) => (
              <div key={item} style={styles.cardStyle}>
                <p style={{ ...styles.cardTextStyle, margin: 0 }}>{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="paths" style={{ marginBottom: '120px' }}>
          <p style={styles.eyebrowStyle}>The Paths</p>

          <h2
            style={{
              ...styles.heroTitleStyle,
              fontSize: 'clamp(2rem, 4vw, 3.6rem)',
              maxWidth: '900px',
              marginBottom: '48px',
            }}
          >
            Which season sounds most like you?
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
              gap: '28px',
            }}
          >
            {paths.map((path) => (
              <div
                key={path.name}
                style={{
                  ...styles.cartBoxStyle,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <p style={styles.eyebrowStyle}>{path.name}</p>

                  <h3
                    style={{
                      ...styles.sectionTitleStyle,
                      fontSize: '1.9rem',
                      marginBottom: '12px',
                    }}
                  >
                    {path.headline}
                  </h3>

                  <p
                    style={{
                      ...styles.bodyStyle,
                      color: 'rgba(245,240,232,0.88)',
                      marginBottom: '20px',
                    }}
                  >
                    {path.tagline}
                  </p>

                  <p style={{ ...styles.bodyStyle, marginBottom: '28px' }}>
                    {path.body}
                  </p>

                  <p
                    style={{
                      ...styles.eyebrowStyle,
                      marginBottom: '14px',
                    }}
                  >
                    Inside {path.name}
                  </p>

                  <div style={{ display: 'grid', gap: '12px', marginBottom: '30px' }}>
                    {path.includes.map((item) => (
                      <p key={item} style={{ ...styles.cardTextStyle, margin: 0 }}>
                        • {item}
                      </p>
                    ))}
                  </div>

                  <div
                    style={{
                      borderTop: '1px solid rgba(197,139,87,0.18)',
                      paddingTop: '22px',
                      marginBottom: '32px',
                    }}
                  >
                    <p style={{ ...styles.eyebrowStyle, marginBottom: '10px' }}>
                      Best For
                    </p>

                    <p style={{ ...styles.cardTextStyle, margin: 0 }}>
                      {path.bestFor}
                    </p>
                  </div>
                </div>

                <a href={path.href} style={styles.primaryButtonStyle}>
                  Explore {path.name}
                </a>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: '120px' }}>
          <p style={styles.eyebrowStyle}>What Life Looks Like Inside Anastasis</p>

          <h2
            style={{
              ...styles.heroTitleStyle,
              fontSize: 'clamp(2rem, 4vw, 3.6rem)',
              maxWidth: '900px',
              marginBottom: '48px',
            }}
          >
            Not another plan to force.
            <br />
            A system to build from.
          </h2>

          <div style={styles.cardGridStyle}>
            {[
              {
                title: 'Week 1',
                text:
                  'You complete your assessment so your starting point, capacity, goals, schedule, nutrition, recovery, and movement history can be understood clearly.',
              },
              {
                title: 'Week 2',
                text:
                  'Your structure begins taking shape through workouts, nutrition direction, recovery timing, and guidance based on the path that fits your needs.',
              },
              {
                title: 'Month 1',
                text:
                  'Patterns become visible. You begin to understand what supports your body, what drains it, and where your capacity needs to be rebuilt first.',
              },
              {
                title: 'Month 2+',
                text:
                  'The system adapts as you do. Strength, energy, confidence, recovery, and consistency become less chaotic and more sustainable.',
              },
            ].map((item) => (
              <div key={item.title} style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>{item.title}</h3>
                <p style={styles.cardTextStyle}>{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            ...styles.cartBoxStyle,
            textAlign: 'center',
            padding: '52px 32px',
            marginBottom: '90px',
          }}
        >
          <p style={styles.eyebrowStyle}>Not Sure Where To Begin?</p>

          <h2
            style={{
              ...styles.heroTitleStyle,
              fontSize: 'clamp(2rem, 4vw, 3.2rem)',
              margin: '0 auto 22px auto',
              maxWidth: '820px',
            }}
          >
            Take the Capacity Assessment.
          </h2>

          <p
            style={{
              ...styles.heroTextStyle,
              maxWidth: '760px',
              margin: '0 auto 36px auto',
            }}
          >
            You do not need to figure it out alone. The Capacity Assessment helps
            determine which path best supports your current season by looking at
            your recovery, stress load, capacity, nutrition, movement, goals, and
            lifestyle demands.
          </p>

          <div style={{ ...styles.buttonRowStyle, justifyContent: 'center' }}>
            <a href="/audit" style={styles.primaryButtonStyle}>
              Help Me Find My Path
            </a>

            <a href="/" style={styles.secondaryButtonStyle}>
              Return Home
            </a>
          </div>
        </section>

      </div>
    </main>
  )
}
