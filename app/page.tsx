import Image from 'next/image'
import AuthAwareCta from '../components/AuthAwareCta'
import MistReveal from '../components/MistReveal'

export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '980px',
          textAlign: 'center',
          margin: '0 auto',
          padding: '72px 24px 120px 24px',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(circle at top, rgba(181,110,67,0.12), transparent 34%)',
            filter: 'blur(60px)',
            opacity: 0.9,
          }}
        />

        <div
          style={{
            marginBottom: '28px',
            animation: 'floatIn 1s ease both',
          }}
        >
        <MistReveal>
          <Image
            src="/Logo.png"
            alt="Anastasis"
            width={180}
            height={180}
            style={{
              margin: '0 auto',
              display: 'block',
              opacity: 0.92,
              filter:
                'drop-shadow(0 0 38px rgba(181,110,67,0.16))',
            }}
          />
        </MistReveal>
      </div>
      
        
        <p
          style={{
            marginTop: '22px',
            letterSpacing: '7px',
            fontSize: '12px',
            color: '#c58b57',
            opacity: 0.82,
            marginBottom: '32px',
            textTransform: 'uppercase',
            animation: 'floatIn 1.2s ease both',
          }}
        >
          Anastasis
        </p>

        
          <h1
            className="hero-headline-delay"
            style={{
              fontSize: 'clamp(2.3rem, 5vw, 4.8rem)',
              lineHeight: 1.18,
              fontWeight: 400,
              maxWidth: '980px',
              margin: '72px auto 42px auto',
              letterSpacing: '-0.04em',
              textAlign: 'center',
              color: '#f5f0e8',
              textWrap: 'balance',
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
            margin: '0 auto 22px auto',
            fontSize: 'clamp(1rem, 2vw, 1.2rem)',
            lineHeight: 1.92,
            color: 'rgba(215,199,182,0.84)',
            animation: 'floatIn 1.3s ease both',
          }}
        >
          Most performance systems were shaped around male physiology, male recovery,
          and male expectations. Then women were told to work harder when their bodies
          did not respond the same way.
        </p>

        <p
          style={{
            maxWidth: '760px',
            margin: '0 auto 52px auto',
            fontSize: 'clamp(1rem, 2vw, 1.12rem)',
            lineHeight: 1.92,
            color: 'rgba(215,199,182,0.78)',
            animation: 'floatIn 1.45s ease both',
          }}
        >
          This is a woman-centered space for precision, relief, and answers. A place
          where your body is not treated like a problem to force, but a language to
          understand. A place that feels like home while finally moving you forward.
        </p>

        <div
          style={{
            display: 'flex',
            gap: '18px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginTop: '56px',
            animation: 'floatIn 1.6s ease both',
          }}
        >
          <AuthAwareCta />

          <a
            href="#method"
            className="button secondary"
            style={{
              minWidth: '220px',
              textAlign: 'center',
            }}
          >
            Explore the Method
          </a>
        </div>

        <div style={{ height: '160px' }} />
      </section>

      <section
        id="method"
        style={{
          padding: '140px 24px 180px',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          style={{
            maxWidth: '980px',
            margin: '0 auto',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              letterSpacing: '6px',
              fontSize: '12px',
              color: '#c58b57',
              opacity: 0.78,
              marginBottom: '28px',
              textTransform: 'uppercase',
            }}
          >
            Why this works
          </p>

          <h2
            style={{
              fontSize: 'clamp(2.3rem, 5vw, 4.6rem)',
              lineHeight: 1.04,
              letterSpacing: '-0.04em',
              margin: '0 auto 42px auto',
              maxWidth: '920px',
              fontWeight: 500,
            }}
          >
            Most women do not plateau.
            <br />
            They outgrow the systems
            <br />
            they were given.
          </h2>

          <p
            style={{
              fontSize: '1.12rem',
              lineHeight: 1.95,
              color: 'rgba(215,199,182,0.82)',
              margin: '0 auto 90px auto',
              maxWidth: '760px',
            }}
          >
            When your body is trained, fed, and pushed through systems built around male
            physiology, male recovery, and male stress patterns, the result is not failure.
            The result is friction.
          </p>

          <div
            style={{
              display: 'grid',
              gap: '26px',
              maxWidth: '860px',
              margin: '0 auto 90px auto',
            }}
          >
            {[
              {
                title: 'You were taught to override signals.',
                body:
                  'Hunger, fatigue, inflammation, stalled progress, poor recovery, and nervous system stress were framed as weaknesses to push past instead of data to understand.',
              },
              {
                title: 'You were given discipline without design.',
                body:
                  'Most women do not need more pressure. They need a system that accounts for female recovery, female stress response, female physiology, and real life.',
              },
              {
                title: 'This method starts somewhere different.',
                body:
                  'Your body is not the problem to conquer. It is the blueprint to read. Once the system begins there, progress stops feeling forced and starts becoming inevitable.',
              },
            ].map((item, index) => (
              <div
                key={index}
                style={{
                  background: 'rgba(18,18,18,0.56)',
                  borderRadius: '34px',
                  padding: '40px 34px',
                  backdropFilter: 'blur(18px)',
                  boxShadow:
                    '0 24px 80px rgba(0,0,0,0.16)',
                }}
              >
                <h3
                  style={{
                    fontSize: '1.38rem',
                    marginBottom: '18px',
                    fontWeight: 500,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {item.title}
                </h3>

                <p
                  style={{
                    fontSize: '1.02rem',
                    lineHeight: 1.95,
                    color: 'rgba(215,199,182,0.82)',
                    margin: 0,
                  }}
                >
                  {item.body}
                </p>
              </div>
            ))}
          </div>

          <p
            style={{
              fontSize: '1.08rem',
              lineHeight: 1.95,
              color: 'rgba(215,199,182,0.8)',
              margin: '0 auto 44px auto',
              maxWidth: '760px',
            }}
          >
            This is not another generic program with a feminine label on top. It is a
            woman-centered system designed to reduce friction, restore trust with your body,
            and create progress that actually fits your physiology.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '18px',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <a
              href="/program"
              className="button primary"
              style={{
                minWidth: '220px',
                textAlign: 'center',
              }}
            >
              View the Program
            </a>

            <a
              href="/apply"
              className="button secondary"
              style={{
                minWidth: '220px',
                textAlign: 'center',
              }}
            >
              Apply Now
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
