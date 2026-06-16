import Image from 'next/image'
import AuthAwareCta from '../components/AuthAwareCta'
import MistReveal from '../components/MistReveal'
import Button from '../components/Button'

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
                filter: 'drop-shadow(0 0 38px rgba(181,110,67,0.16))',
              }}
            />

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
          </MistReveal>
        </div>

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
          For the woman carrying everything.
          <br />
          You did not fail your body.
          <br />
          You need a system built for you.
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
          The children. The work. The meals. The appointments. The invisible
          checklist that never seems to end.
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
          You do not need another plan that ignores your life. You need
          cycle-aware training, nutrition targets, recovery guidance, and
          progress tracking that help you rebuild capacity without losing
          yourself in the process.
        </p>

        <div
          style={{
            display: 'flex',
            gap: '18px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginTop: '56px',
          }}
        >
          <AuthAwareCta />

          <Button href="#seen" variant="secondary">
            See If This Is You
          </Button>
        </div>

        <div style={{ height: '120px' }} />
      </section>

      <section
        id="seen"
        style={{
          padding: '80px 24px 120px',
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
            This is for you if
          </p>

          <h2
            style={{
              fontSize: 'clamp(2.1rem, 5vw, 4.2rem)',
              lineHeight: 1.08,
              letterSpacing: '-0.04em',
              margin: '0 auto 42px auto',
              maxWidth: '920px',
              fontWeight: 500,
            }}
          >
            You know what to do.
            <br />
            You just cannot keep forcing yourself
            <br />
            through systems that do not fit.
          </h2>

          <div
            style={{
              display: 'grid',
              gap: '22px',
              maxWidth: '860px',
              margin: '0 auto 70px auto',
            }}
          >
            {[
              'You are exhausted even when you are doing everything “right.”',
              'You take care of everyone else before yourself.',
              'You have started over more times than you can count.',
              'You want strength, energy, and confidence without living in survival mode.',
              'You need support that adapts to your body, your cycle, your capacity, and your real life.',
            ].map((item) => (
              <div
                key={item}
                style={{
                  background: 'rgba(18,18,18,0.56)',
                  borderRadius: '28px',
                  padding: '26px 28px',
                  backdropFilter: 'blur(18px)',
                  boxShadow: '0 24px 80px rgba(0,0,0,0.16)',
                }}
              >
                <p
                  style={{
                    fontSize: '1.05rem',
                    lineHeight: 1.8,
                    color: 'rgba(215,199,182,0.84)',
                    margin: 0,
                  }}
                >
                  {item}
                </p>
              </div>
            ))}
          </div>

          <Button href="/apply">
            Begin Your Assessment
          </Button>
        </div>
      </section>

      <section
        id="vision"
        style={{
          padding: '100px 24px 140px',
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
            What we are building
          </p>

          <h2
            style={{
              fontSize: 'clamp(2.2rem, 5vw, 4.4rem)',
              lineHeight: 1.06,
              letterSpacing: '-0.04em',
              margin: '0 auto 42px auto',
              maxWidth: '920px',
              fontWeight: 500,
            }}
          >
            The goal is not to push harder.
            <br />
            The goal is to expand your capacity.
          </h2>

          <p
            style={{
              fontSize: '1.12rem',
              lineHeight: 1.95,
              color: 'rgba(215,199,182,0.82)',
              margin: '0 auto 28px auto',
              maxWidth: '760px',
            }}
          >
            Anastasis is designed to help you understand what your body can
            recover from, where your energy is going, and how to move forward
            without constantly abandoning yourself to make progress.
          </p>

          <p
            style={{
              fontSize: '1.08rem',
              lineHeight: 1.95,
              color: 'rgba(215,199,182,0.78)',
              margin: '0 auto 54px auto',
              maxWidth: '760px',
            }}
          >
            This is not about doing more. It is about building enough physical,
            mental, and emotional reserve to trust yourself again.
          </p>

          <Button href="/program" variant="secondary">
            View the Program
          </Button>
        </div>
      </section>

      <section
        id="method"
        style={{
          padding: '100px 24px 180px',
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
            How it works
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
            Your body is not the problem.
            <br />
            It is the blueprint.
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
            The system begins with your cycle, your current capacity, your
            goals, and your real life. From there, Anastasis guides training,
            nutrition, recovery, and progress tracking around what your body can
            actually sustain.
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
                title: 'Cycle-aware training',
                body:
                  'Your program accounts for where you are in your cycle so training and recovery stop feeling random.',
              },
              {
                title: 'Nutrition targets without obsession',
                body:
                  'You receive macro and hydration guidance designed to support your goals without turning food into another source of pressure.',
              },
              {
                title: 'Recovery that counts',
                body:
                  'Recovery is treated as part of the system, not as something you earn after you have done enough.',
              },
              {
                title: 'Progress you can actually see',
                body:
                  'Measurements and progress photos help you track change without relying only on the scale.',
              },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  background: 'rgba(18,18,18,0.56)',
                  borderRadius: '34px',
                  padding: '40px 34px',
                  backdropFilter: 'blur(18px)',
                  boxShadow: '0 24px 80px rgba(0,0,0,0.16)',
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
            You do not need another plan to follow. You need a system that helps
            you carry your life without losing yourself in it.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '18px',
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginTop: '32px',
            }}
          >
            <Button href="/apply">
              Begin Your Assessment
            </Button>

            <Button href="/program" variant="secondary">
              View the Program
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
