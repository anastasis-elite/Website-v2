export default function Home() {
  return (
    <main
      style={{
        background: '#000',
        color: '#f5f0e8',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '820px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            marginBottom: '64px',
            color: '#c58b57',
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            fontSize: '0.8rem',
          }}
        >
          Anastasis
        </div>

        <h1
          style={{
            fontSize: 'clamp(2.5rem, 6vw, 5.2rem)',
            lineHeight: 1.0,
            fontWeight: 500,
            margin: '0 0 24px 0',
          }}
        >
          You did not fail your body.
          <br />
          You were handed a system
          <br />
          that was never built for women.
        </h1>

        <p
          style={{
            maxWidth: '760px',
            margin: '0 auto 20px auto',
            fontSize: 'clamp(1rem, 2vw, 1.25rem)',
            lineHeight: 1.7,
            color: '#d7c7b6',
          }}
        >
          Most performance systems were shaped around male physiology, male recovery,
          and male expectations. Then women were told to work harder when their bodies
          did not respond the same way.
        </p>

        <p
          style={{
            maxWidth: '760px',
            margin: '0 auto 40px auto',
            fontSize: 'clamp(1rem, 2vw, 1.15rem)',
            lineHeight: 1.7,
            color: '#d7c7b6',
          }}
        >
          This is a woman-centered space for precision, relief, and answers. A place
          where your body is not treated like a problem to force, but a language to
          understand. A place that feels like home while finally moving you forward.
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
            href="mailto:hello@anastasiselite.com"
            style={{
              background: '#c58b57',
              color: '#000',
              padding: '14px 24px',
              textDecoration: 'none',
              borderRadius: '999px',
              fontWeight: 600,
            }}
          >
            Begin Here
          </a>

          <a
            href="#method"
            style={{
              border: '1px solid #c58b57',
              color: '#f5f0e8',
              padding: '14px 24px',
              textDecoration: 'none',
              borderRadius: '999px',
              fontWeight: 500,
              opacity: 0.8,
            }}
          >
            Explore the Method
          </a>
        </div>
      </section>
    </main>
  )
}
