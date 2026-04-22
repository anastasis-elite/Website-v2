export default function ProgramPage() {
  return (
    <main
      style={{
        background: '#000',
        color: '#f5f0e8',
        minHeight: '100vh',
        padding: '120px 24px',
      }}
    >
      <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
        <section style={{ marginBottom: '120px' }}>
          <p
            style={{
              letterSpacing: '6px',
              fontSize: '12px',
              color: '#c58b57',
              opacity: 0.85,
              marginBottom: '24px',
              textTransform: 'uppercase',
            }}
          >
            The Program
          </p>

          <h1
            style={{
              fontSize: 'clamp(2.8rem, 5vw, 5.2rem)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              margin: '0 0 28px 0',
              maxWidth: '980px',
            }}
          >
            A woman-centered system built for progress that actually fits your body.
          </h1>

          <p
            style={{
              fontSize: '1.14rem',
              lineHeight: 1.9,
              color: '#d7c7b6',
              maxWidth: '820px',
              marginBottom: '48px',
            }}
          >
            This is not another generic fitness structure repackaged in softer language.
            It is a system designed around female physiology, female recovery, female
            stress response, and the reality that women do not need more punishment.
            They need better design.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <a
              href="/apply"
              style={{
                background: '#c58b57',
                color: '#000',
                padding: '14px 24px',
                textDecoration: 'none',
                borderRadius: '999px',
                fontWeight: 600,
              }}
            >
              Apply Now
            </a>

            <a
              href="/"
              style={{
                border: '1px solid #c58b57',
                color: '#f5f0e8',
                padding: '14px 24px',
                textDecoration: 'none',
                borderRadius: '999px',
                fontWeight: 500,
                opacity: 0.85,
              }}
            >
              Return Home
            </a>
          </div>
        </section>

        <section style={{ marginBottom: '120px' }}>
          <div
            style={{
              display: 'grid',
              gap: '28px',
            }}
          >
            <div
              style={{
                border: '1px solid rgba(197,139,87,0.22)',
                borderRadius: '28px',
                padding: '36px 32px',
                background: 'rgba(255,255,255,0.01)',
              }}
            >
              <h2
                style={{
                  fontSize: '1.5rem',
                  marginBottom: '16px',
                  fontWeight: 500,
                }}
              >
                What makes this different
              </h2>

              <p
                style={{
                  fontSize: '1.05rem',
                  lineHeight: 1.85,
                  color: '#d7c7b6',
                  margin: 0,
                  maxWidth: '860px',
                }}
              >
                Most programs are built around male recovery speed, male hormonal rhythm,
                male stress patterns, and male performance assumptions. Women are then told
                to adapt to systems that were never designed with them in mind. This method
                begins in the opposite place. It starts by reading your body correctly, then
                building the structure around what supports progress instead of what creates
                more friction.
              </p>
            </div>

            <div
              style={{
                border: '1px solid rgba(197,139,87,0.22)',
                borderRadius: '28px',
                padding: '36px 32px',
                background: 'rgba(255,255,255,0.01)',
              }}
            >
              <h2
                style={{
                  fontSize: '1.5rem',
                  marginBottom: '16px',
                  fontWeight: 500,
                }}
              >
                What this is designed to do
              </h2>

              <p
                style={{
                  fontSize: '1.05rem',
                  lineHeight: 1.85,
                  color: '#d7c7b6',
                  margin: 0,
                  maxWidth: '860px',
                }}
              >
                Reduce friction. Restore trust with your body. Create progress that feels
                aligned instead of forced. Support performance without making you pay for it
                with exhaustion, volatility, shutdown, or self-blame. Build a system that
                helps you become stronger, more regulated, more responsive, and more precise
                over time.
              </p>
            </div>

            <div
              style={{
                border: '1px solid rgba(197,139,87,0.22)',
                borderRadius: '28px',
                padding: '36px 32px',
                background: 'rgba(255,255,255,0.01)',
              }}
            >
              <h2
                style={{
                  fontSize: '1.5rem',
                  marginBottom: '16px',
                  fontWeight: 500,
                }}
              >
                Who this is for
              </h2>

              <p
                style={{
                  fontSize: '1.05rem',
                  lineHeight: 1.85,
                  color: '#d7c7b6',
                  margin: 0,
                  maxWidth: '860px',
                }}
              >
                Women who are tired of being told to just push harder. Women who have done
                the work, stayed disciplined, followed the plan, and still felt like their
                body was resisting them. Women who want a system that respects both ambition
                and biology. Women who are ready for structure that feels intelligent,
                supportive, and exact.
              </p>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: '120px' }}>
          <p
            style={{
              letterSpacing: '6px',
              fontSize: '12px',
              color: '#c58b57',
              opacity: 0.85,
              marginBottom: '24px',
              textTransform: 'uppercase',
            }}
          >
            Inside the method
          </p>

          <h2
            style={{
              fontSize: 'clamp(2rem, 4vw, 3.6rem)',
              lineHeight: 1.12,
              letterSpacing: '-0.02em',
              margin: '0 0 40px 0',
              maxWidth: '900px',
            }}
          >
            The system is not built on more pressure.
            <br />
            It is built on better calibration.
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '22px',
            }}
          >
            {[
              {
                title: 'Physiology-aware structure',
                text:
                  'Training and progress are approached through the reality of female recovery, stress response, energy fluctuation, and body feedback.',
              },
              {
                title: 'Nervous system respect',
                text:
                  'The body is not treated like a machine to override. Signals are used as guidance so progress becomes more sustainable and more intelligent.',
              },
              {
                title: 'Precision over chaos',
                text:
                  'Every element is intended to reduce decision fatigue and create clarity, rhythm, and consistency instead of more overwhelm.',
              },
              {
                title: 'Real-life execution',
                text:
                  'This is built for women with actual lives, real stress, real responsibilities, and bodies that deserve better than generic formulas.',
              },
              {
                title: 'Supportive progression',
                text:
                  'The aim is not just to make you work. The aim is to make your effort translate into movement, strength, trust, and visible progress.',
              },
              {
                title: 'Designed outcomes',
                text:
                  'This is not random motivation. It is a system built to create a clear path from confusion and friction into alignment and momentum.',
              },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  border: '1px solid rgba(197,139,87,0.18)',
                  borderRadius: '24px',
                  padding: '28px 24px',
                  background: 'rgba(255,255,255,0.01)',
                }}
              >
                <h3
                  style={{
                    fontSize: '1.2rem',
                    marginBottom: '12px',
                    fontWeight: 500,
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    fontSize: '1rem',
                    lineHeight: 1.8,
                    color: '#d7c7b6',
                    margin: 0,
                  }}
                >
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: '120px' }}>
          <p
            style={{
              letterSpacing: '6px',
              fontSize: '12px',
              color: '#c58b57',
              opacity: 0.85,
              marginBottom: '24px',
              textTransform: 'uppercase',
            }}
          >
            What this can feel like
          </p>

          <div
            style={{
              display: 'grid',
              gap: '24px',
              maxWidth: '900px',
            }}
          >
            {[
              'Feeling like your body is finally being read correctly instead of fought.',
              'Having a structure that feels clear, calm, and supportive instead of chaotic.',
              'Experiencing progress that does not require constant self-override to maintain.',
              'Being able to trust your body’s feedback instead of resenting it.',
              'Feeling more anchored, more capable, and less trapped in friction.',
            ].map((line) => (
              <div
                key={line}
                style={{
                  borderLeft: '2px solid #c58b57',
                  paddingLeft: '18px',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: '1.06rem',
                    lineHeight: 1.8,
                    color: '#d7c7b6',
                  }}
                >
                  {line}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section
          style={{
            border: '1px solid rgba(197,139,87,0.22)',
            borderRadius: '32px',
            padding: '42px 32px',
            background: 'rgba(255,255,255,0.01)',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              letterSpacing: '6px',
              fontSize: '12px',
              color: '#c58b57',
              opacity: 0.85,
              marginBottom: '24px',
              textTransform: 'uppercase',
            }}
          >
            Next step
          </p>

          <h2
            style={{
              fontSize: 'clamp(2rem, 4vw, 3.2rem)',
              lineHeight: 1.12,
              letterSpacing: '-0.02em',
              margin: '0 auto 22px auto',
              maxWidth: '760px',
            }}
          >
            If this feels like relief, that is the point.
          </h2>

          <p
            style={{
              fontSize: '1.08rem',
              lineHeight: 1.85,
              color: '#d7c7b6',
              maxWidth: '760px',
              margin: '0 auto 36px auto',
            }}
          >
            The next step is application and fit. This is designed to be intentional,
            supportive, and aligned — not mass-market, rushed, or impersonal.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '16px',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <a
              href="/apply"
              style={{
                background: '#c58b57',
                color: '#000',
                padding: '14px 24px',
                textDecoration: 'none',
                borderRadius: '999px',
                fontWeight: 600,
              }}
            >
              Apply Now
            </a>

            <a
              href="/"
              style={{
                border: '1px solid #c58b57',
                color: '#f5f0e8',
                padding: '14px 24px',
                textDecoration: 'none',
                borderRadius: '999px',
                fontWeight: 500,
                opacity: 0.85,
              }}
            >
              Return Home
            </a>
          </div>
        </section>
      </div>
    </main>
  )
}
