export default function ApplyPage() {
  return (
    <main
      style={{
        background: '#000',
        color: '#f5f0e8',
        minHeight: '100vh',
        padding: '120px 24px',
      }}
    >
      <div style={{ maxWidth: '980px', margin: '0 auto' }}>
        <section style={{ marginBottom: '110px' }}>
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
            Apply
          </p>

          <h1
            style={{
              fontSize: 'clamp(2.8rem, 5vw, 5rem)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              margin: '0 0 28px 0',
              maxWidth: '900px',
            }}
          >
            Start the process.
          </h1>

          <p
            style={{
              fontSize: '1.12rem',
              lineHeight: 1.9,
              color: '#d7c7b6',
              maxWidth: '780px',
              marginBottom: '36px',
            }}
          >
            This is not a rushed checkout and it is not a mass-market intake. The
            application exists to make sure the work is aligned, the fit is right,
            and the structure supports the woman entering it.
          </p>

          <p
            style={{
              fontSize: '1.05rem',
              lineHeight: 1.85,
              color: '#d7c7b6',
              maxWidth: '780px',
              marginBottom: '48px',
            }}
          >
            If you are here, you are not being asked to prove your worth. You are
            simply stepping into a more intentional process.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <a
              href="#application-form"
              style={{
                background: '#c58b57',
                color: '#000',
                padding: '14px 24px',
                textDecoration: 'none',
                borderRadius: '999px',
                fontWeight: 600,
              }}
            >
              Begin Application
            </a>

            <a
              href="/program"
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
              Return to Program
            </a>
          </div>
        </section>

        <section style={{ marginBottom: '110px' }}>
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
                padding: '34px 30px',
                background: 'rgba(255,255,255,0.01)',
              }}
            >
              <h2
                style={{
                  fontSize: '1.45rem',
                  marginBottom: '14px',
                  fontWeight: 500,
                }}
              >
                What applying means
              </h2>
              <p
                style={{
                  fontSize: '1.04rem',
                  lineHeight: 1.85,
                  color: '#d7c7b6',
                  margin: 0,
                  maxWidth: '860px',
                }}
              >
                Applying means we are looking at fit, readiness, needs, and alignment.
                It means this is being treated with care instead of being pushed through
                a generic funnel.
              </p>
            </div>

            <div
              style={{
                border: '1px solid rgba(197,139,87,0.22)',
                borderRadius: '28px',
                padding: '34px 30px',
                background: 'rgba(255,255,255,0.01)',
              }}
            >
              <h2
                style={{
                  fontSize: '1.45rem',
                  marginBottom: '14px',
                  fontWeight: 500,
                }}
              >
                What you can expect
              </h2>
              <p
                style={{
                  fontSize: '1.04rem',
                  lineHeight: 1.85,
                  color: '#d7c7b6',
                  margin: 0,
                  maxWidth: '860px',
                }}
              >
                You can expect questions that clarify where you are, what you need,
                and whether this is the right structure for you. The process is meant
                to create clarity, not pressure.
              </p>
            </div>

            <div
              style={{
                border: '1px solid rgba(197,139,87,0.22)',
                borderRadius: '28px',
                padding: '34px 30px',
                background: 'rgba(255,255,255,0.01)',
              }}
            >
              <h2
                style={{
                  fontSize: '1.45rem',
                  marginBottom: '14px',
                  fontWeight: 500,
                }}
              >
                What happens next
              </h2>
              <p
                style={{
                  fontSize: '1.04rem',
                  lineHeight: 1.85,
                  color: '#d7c7b6',
                  margin: 0,
                  maxWidth: '860px',
                }}
              >
                Once your application is submitted, the next step is review and
                response. From there, you will either be guided into the next phase
                or redirected with honesty and care.
              </p>
            </div>
          </div>
        </section>

        <section
          id="application-form"
          style={{
            border: '1px solid rgba(197,139,87,0.22)',
            borderRadius: '32px',
            padding: '42px 32px',
            background: 'rgba(255,255,255,0.01)',
            marginBottom: '80px',
          }}
        >
          <p
            style={{
              letterSpacing: '6px',
              fontSize: '12px',
              color: '#c58b57',
              opacity: 0.85,
              marginBottom: '20px',
              textTransform: 'uppercase',
            }}
          >
            Application
          </p>

          <h2
            style={{
              fontSize: 'clamp(2rem, 4vw, 3.2rem)',
              lineHeight: 1.12,
              letterSpacing: '-0.02em',
              margin: '0 0 20px 0',
              maxWidth: '760px',
            }}
          >
            This is where your application or intake form will live.
          </h2>

          <p
            style={{
              fontSize: '1.08rem',
              lineHeight: 1.85,
              color: '#d7c7b6',
              maxWidth: '760px',
              marginBottom: '32px',
            }}
          >
            For now, this section can hold your temporary form link, application
            steps, or intake instructions until the full submission flow is connected.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <a
              href="mailto:hello@anastasiselite.com?subject=Application%20Inquiry"
              style={{
                background: '#c58b57',
                color: '#000',
                padding: '14px 24px',
                textDecoration: 'none',
                borderRadius: '999px',
                fontWeight: 600,
              }}
            >
              Submit via Email
            </a>

            <a
              href="/program"
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
              Review Program Again
            </a>
          </div>
        </section>
      </div>
    </main>
  )
}
