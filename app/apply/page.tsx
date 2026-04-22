
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
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
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
            fontSize: 'clamp(2.5rem, 5vw, 4.8rem)',
            lineHeight: 1.12,
            letterSpacing: '-0.02em',
            marginBottom: '28px',
          }}
        >
          Start the process.
        </h1>

        <p
          style={{
            fontSize: '1.1rem',
            lineHeight: 1.85,
            color: '#d7c7b6',
            maxWidth: '760px',
            marginBottom: '40px',
          }}
        >
          This page will hold your application, intake, or approval process. For now,
          it gives your site a real destination and completes the first branch of the funnel.
        </p>

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
            display: 'inline-block',
          }}
        >
          Back to Program
        </a>
      </div>
    </main>
  )
}
