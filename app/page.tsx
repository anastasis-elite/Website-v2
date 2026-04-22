import Image from 'next/image'
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
        padding: '140px 24px 120px 24px',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '820px',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: '80px' }}>
  <Image
    src="/blacklogo.jpeg"
    alt="Anastasis"
    width={180}
    height={180}
    style={{
      margin: '0 auto',
      display: 'block',
      opacity: 0.9,
      filter: 'drop-shadow(0 0 10px rgba(197,139,87,0.25))'
    }}
  />
</div>

        <h1
          style={{
            fontSize: 'clamp(2.5rem, 6vw, 5.2rem)',
            lineHeight: 1.08,
            fontWeight: 500,
            maxWidth: '900px',
            margin: '0 auto 40px auto',
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
          <section
  id="method"
  style={{
    background: '#000',
    color: '#f5f0e8',
    padding: '180px 24px',
    textAlign: 'center'
  }}
>
 <div
  style={{
    display: 'flex',
    gap: '16px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: '40px'
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
      opacity: 0.8
    }}
  >
    Explore the Method
  </a>
</div>
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '120px' }}>

    <h2 style={{
      fontSize: 'clamp(2rem, 4vw, 3rem)',
      marginBottom: '32px',
      fontWeight: 500
    }}>
      Most women don’t plateau.
      <br />
      They adapt to systems that were never built for them.
    </h2>

    <p style={{
      fontSize: '1.1rem',
      lineHeight: 1.8,
      color: '#d7c7b6',
      marginBottom: '24px'
    }}>
      Training protocols, recovery expectations, and performance standards were
      largely shaped around male physiology — faster recovery cycles, different
      hormonal environments, and completely different stress responses.
    </p>

    <p style={{
      fontSize: '1.1rem',
      lineHeight: 1.8,
      color: '#d7c7b6',
      marginBottom: '24px'
    }}>
      When a woman follows those same structures, she doesn’t fail because she
      lacks discipline. She stalls because her body is adapting to survive
      something it was never designed to sustain.
    </p>

    <p style={{
      fontSize: '1.1rem',
      lineHeight: 1.8,
      color: '#d7c7b6'
    }}>
      This method starts from a different premise: your body is not the problem.
      It is the blueprint.
    </p>

  </div>
</section>
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
