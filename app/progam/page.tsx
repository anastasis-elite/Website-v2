
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
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
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
            fontSize: 'clamp(2.5rem, 5vw, 4.8rem)',
            lineHeight: 1.12,
            letterSpacing: '-0.02em',
            margin: '0 0 28px 0',
            maxWidth: '900px',
          }}
        >
          A woman-centered system designed for progress that actually fits your body.
        </h1>

        <p
          style={{
            fontSize: '1.12rem',
            lineHeight: 1.85,
            color: '#d7c7b6',
            maxWidth: '760px',
            marginBottom: '56px',
          }}
        >
          This is not another generic fitness framework dressed up in softer language.
          It is a physiology-aware, woman-centered method built to reduce friction,
          restore trust with your body, and create progress without forcing you to
          fight yourself to get there.
        </p>

        <div
          style={{
            display: 'grid',
            gap: '28px',
            marginBottom: '60px',
          }}
        >
          <div
            style={{
              border: '1px solid rgba(197,139,87,0.22)',
              borderRadius: '28px',
              padding: '32px 28px',
              background: 'rgba(255,255,255,0.01)',
            }}
          >
            <h2 style={{ fontSize: '1.45rem', marginBottom: '14px', fontWeight: 500 }}>
              What makes it different
            </h2>
            <p style={{ fontSize: '1.05rem', lineHeight: 1.8, color: '#d7c7b6', margin: 0 }}>
              This program accounts for female physiology, recovery, stress response,
              real-life execution, and the fact that women are not smaller men.
            </p>
          </div>

          <div
            style={{
              border: '1px solid rgba(197,139,87,0.22)',
              borderRadius: '28px',
              padding: '32px 28px',
              background: 'rgba(255,255,255,0.01)',
            }}
          >
            <h2 style={{ fontSize: '1.45rem', marginBottom: '14px', fontWeight: 500 }}>
              Who it is for
            </h2>
            <p style={{ fontSize: '1.05rem', lineHeight: 1.8, color: '#d7c7b6', margin: 0 }}>
              Women who are done cycling through programs that demand more force,
              more punishment, and more self-blame instead of better design.
            </p>
          </div>

          <div
            style={{
              border: '1px solid rgba(197,139,87,0.22)',
              borderRadius: '28px',
              padding: '32px 28px',
              background: 'rgba(255,255,255,0.01)',
            }}
          >
            <h2 style={{ fontSize: '1.45rem', marginBottom: '14px', fontWeight: 500 }}>
              What happens next
            </h2>
            <p style={{ fontSize: '1.05rem', lineHeight: 1.8, color: '#d7c7b6', margin: 0 }}>
              The next step is application and fit. This is designed to be intentional,
              supportive, and aligned — not mass-market and impersonal.
            </p>
          </div>
        </div>

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
      </div>
    </main>
  )
}
