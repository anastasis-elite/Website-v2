
export default function EmberWhyPage() {
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
          Why Ember
        </p>

        <h1
          style={{
            fontSize: 'clamp(2.8rem, 5vw, 5rem)',
            lineHeight: 1.1,
            marginBottom: '28px',
          }}
        >
          Why Ember was recommended.
        </h1>

        <p
          style={{
            fontSize: '1.1rem',
            lineHeight: 1.9,
            color: '#d7c7b6',
            maxWidth: '760px',
          }}
        >
          Ember is recommended when a woman appears ready for a clear, structured,
          self-led path with less complexity and more precision.
        </p>

        <a
          href="/program/ember/cart"
          style={{
            display: 'inline-block',
            marginTop: '40px',
            background: '#c58b57',
            color: '#000',
            padding: '14px 24px',
            borderRadius: '999px',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Continue to Ember
        </a>
      </div>
    </main>
  )
}
