import Image from 'next/image'
import Button from '../components/Button'
import MistReveal from '../components/MistReveal'
import TrackEvent from '@/components/TrackEvent'
import TrackedButton from '@/components/TrackedButton'

export default function Home() {
  export default function Home() {
  return (
    <main
      style={{
        minHeight: '100vh',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <TrackEvent
        event="landing_page_viewed"
        properties={{ page: 'landing' }}
      />
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

        <div style={{ marginBottom: '28px' }}>
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
          The woman you miss is still there.
          <br />
          
        </h1>

        <p
          style={{
            maxWidth: '760px',
            margin: '0 auto 22px auto',
            fontSize: 'clamp(1rem, 2vw, 1.2rem)',
            lineHeight: 1.92,
            color: 'rgba(215,199,182,0.84)',
          }}
        >
          You don't need more discipline.
          </br>
          You don't need another diet.
          </br>
          You need enough capacity to finally hear yourself again.
          </br>
          Take the Capacity Audit and discover what's actually draining your energy, motivation, recovery, and sense of self.
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
          }}
        >
          Anastasis helps high-capacity women build strength, energy,
          nourishment, recovery, and capacity through a system that adapts to
          their body, cycle, stress load, and real life.
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
          <Button href="#how-it-works">How It Works</Button>

          <TrackedButton
  href="/audit"
  event="audit_cta_clicked_1"
  properties={{ location: 'hero', page: 'landing' }}
>
  The Capacity Audit
</TrackedButton>
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
              'You need support that adapts to your body, your cycle, your capacity, and your real responsibilities.',
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

          <Button href="#how-it-works">Show Me the System</Button>
        </div>
      </section>

      <section
        id="what-it-is"
        style={{
          padding: '100px 24px 120px',
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
            What Anastasis is
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
            Fitness, nutrition, and recovery designed around the woman carrying
            the load.
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
            This is not another plan asking you to ignore your body, your
            responsibilities, your cycle, your stress, or your recovery.
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
            Anastasis is an adaptive women’s wellness system built to help you
            train, eat, recover, and rebuild capacity without abandoning
            yourself to make progress.
          </p>
        </div>
      </section>

      <section
        id="how-it-works"
        style={{
          padding: '100px 24px 140px',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          style={{
            maxWidth: '1080px',
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
            Assess.
            <br />
            Adapt.
            <br />
            Expand.
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
            The goal is not to push harder forever. The goal is to understand
            where your capacity is now, support what is under-recovered, and
            build a structure your life can actually sustain.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '26px',
              margin: '0 auto 90px auto',
            }}
          >
            {[
              {
                title: '1. Assess',
                body:
                  'We look at your current capacity, goals, recovery, cycle, nutrition, schedule, stress load, movement history, and what your body needs first.',
              },
              {
                title: '2. Adapt',
                body:
                  'Your training, nutrition targets, recovery recommendations, and progress tracking are built around your real life instead of an ideal version of it.',
              },
              {
                title: '3. Expand',
                body:
                  'As your body becomes stronger and better supported, the system helps you build more energy, resilience, confidence, and capacity over time.',
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
                  textAlign: 'left',
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

          <div
            style={{
              maxWidth: '860px',
              margin: '0 auto 70px auto',
              background: 'rgba(18,18,18,0.52)',
              borderRadius: '34px',
              padding: '42px 34px',
              backdropFilter: 'blur(18px)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
            }}
          >
            <h3
              style={{
                fontSize: '1.5rem',
                marginBottom: '18px',
                fontWeight: 500,
              }}
            >
              What this means in real life
            </h3>

            <p
              style={{
                fontSize: '1.05rem',
                lineHeight: 1.9,
                color: 'rgba(215,199,182,0.82)',
                margin: 0,
              }}
            >
              You stop guessing. You stop starting over. You stop treating your
              body like the problem. You begin with the right level of support,
              then build from there.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '18px',
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginTop: '32px',
            }}
          >
            <Button href="/program">Choose Your Path</Button>

            <TrackedButton
  href="/audit"
  event="audit_cta_clicked_2"
  properties={{ location: 'hero', page: 'landing' }}
>
  Take the Capacity Audit
</TrackedButton>
          </div>
        </div>
      </section>
    </main>
    </>
  )
}
