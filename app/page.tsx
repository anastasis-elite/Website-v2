import type { Metadata } from 'next'
import Image from 'next/image'
import Button from '../components/Button'
import MistReveal from '../components/MistReveal'
import TrackEvent from '@/components/TrackEvent'
import TrackedButton from '@/components/TrackedButton'
import { BRAND_NAME, BRAND_TITLE } from '@/lib/seo'

const homeDescription =
  'Anastasis brings personalized fitness, nutrition, recovery, progress tracking, and daily support into one adaptive health and performance platform for women.'

export const metadata: Metadata = {
  title: BRAND_TITLE,
  description: homeDescription,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: BRAND_TITLE,
    description: homeDescription,
    url: '/',
    siteName: BRAND_NAME,
  },
  twitter: {
    card: 'summary',
    title: BRAND_TITLE,
    description: homeDescription,
  },
}

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
          padding: '72px 24px 120px',
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
              priority
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
              Health & Performance Concierge
            </p>
          </MistReveal>
        </div>

        <h1
          className="hero-headline-delay"
          style={{
            fontSize: 'clamp(2.3rem, 5vw, 4.8rem)',
            lineHeight: 1.12,
            fontWeight: 400,
            maxWidth: '980px',
            margin: '72px auto 42px',
            letterSpacing: '-0.04em',
            textAlign: 'center',
            color: '#f5f0e8',
            textWrap: 'balance',
          }}
        >
          Stop managing your health
          <br />
          like another full-time job.
        </h1>

        <p
          style={{
            maxWidth: '790px',
            margin: '0 auto 24px',
            fontSize: 'clamp(1.05rem, 2vw, 1.24rem)',
            lineHeight: 1.9,
            color: 'rgba(215,199,182,0.88)',
            textWrap: 'balance',
          }}
        >
          Anastasis turns your body, schedule, goals, symptoms, recovery, and
          real life into a personalized plan—so you know what to do, when to do
          it, and what can wait.
        </p>

        <p
          style={{
            maxWidth: '760px',
            margin: '0 auto 18px',
            fontSize: 'clamp(1rem, 2vw, 1.12rem)',
            lineHeight: 1.88,
            color: 'rgba(215,199,182,0.76)',
          }}
        >
          Start with the Capacity Audit to uncover what is consuming your
          energy, limiting your performance, and creating unnecessary health
          decisions.
        </p>

        <p
          style={{
            maxWidth: '720px',
            margin: '0 auto 52px',
            fontSize: '0.96rem',
            lineHeight: 1.8,
            color: 'rgba(197,139,87,0.9)',
          }}
        >
          In approximately 10 minutes, you will receive a clear starting point,
          your highest-priority areas, and the Anastasis path designed for your
          current needs.
        </p>

        <div
          style={{
            display: 'flex',
            gap: '18px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginTop: '36px',
          }}
        >
          <TrackedButton
            href="/audit"
            event="audit_cta_clicked_1"
            properties={{ location: 'hero', page: 'landing' }}
          >
            Build My Personalized Plan
          </TrackedButton>

          <Button href="#how-it-works">See How It Works</Button>
        </div>

        <div style={{ marginTop: '22px' }}>
          <Button href="/what-is-anastasis" variant="secondary">
            What is Anastasis?
          </Button>
        </div>

        <div
          style={{
            margin: '54px auto 0',
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '12px 28px',
            color: 'rgba(215,199,182,0.58)',
            fontSize: '0.86rem',
            letterSpacing: '0.02em',
          }}
        >
          <span>Approximately 10 minutes</span>
          <span>Personalized starting point</span>
          <span>Clear next step</span>
        </div>

        <div style={{ height: '100px' }} />
      </section>

      <section
        id="outcome"
        style={{
          padding: '90px 24px 120px',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          style={{
            maxWidth: '1020px',
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
            What you receive
          </p>

          <h2
            style={{
              fontSize: 'clamp(2.1rem, 5vw, 4.2rem)',
              lineHeight: 1.08,
              letterSpacing: '-0.04em',
              margin: '0 auto 34px',
              maxWidth: '920px',
              fontWeight: 500,
              textWrap: 'balance',
            }}
          >
            One assessment.
            <br />
            A clear path forward.
          </h2>

          <p
            style={{
              maxWidth: '770px',
              margin: '0 auto 68px',
              fontSize: '1.1rem',
              lineHeight: 1.92,
              color: 'rgba(215,199,182,0.8)',
            }}
          >
            The Capacity Audit does more than give you a score. It identifies
            what deserves your attention first, what can stop becoming another
            priority, and what level of support will reduce the load you have
            been carrying.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '22px',
              maxWidth: '980px',
              margin: '0 auto 64px',
            }}
          >
            {[
              {
                title: 'What is draining you',
                body:
                  'See which areas of your health, recovery, routine, and daily life are consuming the most capacity.',
              },
              {
                title: 'What matters first',
                body:
                  'Understand which changes will create the greatest return instead of trying to improve everything at once.',
              },
              {
                title: 'What can wait',
                body:
                  'Stop turning every possible improvement into another urgent task on an already full list.',
              },
              {
                title: 'What support fits',
                body:
                  'Receive a clear recommendation for the Anastasis experience that matches your current needs and level of capacity.',
              },
            ].map((item) => (
              <div
                key={item.title}
                style={{
                  background: 'rgba(18,18,18,0.56)',
                  borderRadius: '30px',
                  padding: '34px 30px',
                  backdropFilter: 'blur(18px)',
                  boxShadow: '0 24px 80px rgba(0,0,0,0.16)',
                  textAlign: 'left',
                }}
              >
                <h3
                  style={{
                    fontSize: '1.24rem',
                    margin: '0 0 14px',
                    fontWeight: 500,
                    letterSpacing: '-0.02em',
                    color: '#f5f0e8',
                  }}
                >
                  {item.title}
                </h3>

                <p
                  style={{
                    fontSize: '1rem',
                    lineHeight: 1.85,
                    color: 'rgba(215,199,182,0.8)',
                    margin: 0,
                  }}
                >
                  {item.body}
                </p>
              </div>
            ))}
          </div>

          <TrackedButton
            href="/audit"
            event="audit_cta_clicked_2"
            properties={{ location: 'outcome', page: 'landing' }}
          >
            Show Me What to Prioritize
          </TrackedButton>
        </div>
      </section>

      <section
        id="seen"
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
            The real problem
          </p>

          <h2
            style={{
              fontSize: 'clamp(2.1rem, 5vw, 4.2rem)',
              lineHeight: 1.08,
              letterSpacing: '-0.04em',
              margin: '0 auto 38px',
              maxWidth: '920px',
              fontWeight: 500,
              textWrap: 'balance',
            }}
          >
            You do not need
            <br />
            more health information.
          </h2>

          <p
            style={{
              maxWidth: '780px',
              margin: '0 auto 28px',
              fontSize: '1.12rem',
              lineHeight: 1.94,
              color: 'rgba(215,199,182,0.84)',
            }}
          >
            You already know that sleep, movement, nutrition, stress, recovery,
            and consistency matter.
          </p>

          <p
            style={{
              maxWidth: '790px',
              margin: '0 auto 70px',
              fontSize: '1.08rem',
              lineHeight: 1.94,
              color: 'rgba(215,199,182,0.76)',
            }}
          >
            The problem is having to decide—every single day—how all of it
            applies to your body, your goals, your schedule, your symptoms, and
            your current capacity.
          </p>

          <div
            style={{
              display: 'grid',
              gap: '22px',
              maxWidth: '860px',
              margin: '0 auto 70px',
            }}
          >
            {[
              'You are constantly deciding what to eat, how to train, when to rest, and whether you are doing enough.',
              'You are piecing together symptoms, cycle changes, soreness, recovery, stress, and competing recommendations.',
              'You have plans that only work when your life is calm, predictable, and centered around following them.',
              'Taking care of yourself has become one more system you are responsible for managing.',
              'You do not need more motivation. You need fewer decisions and better direction.',
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

          <Button href="#what-it-is">See the Difference</Button>
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
            maxWidth: '1020px',
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
            What Anastasis changes
          </p>

          <h2
            style={{
              fontSize: 'clamp(2.2rem, 5vw, 4.4rem)',
              lineHeight: 1.06,
              letterSpacing: '-0.04em',
              margin: '0 auto 42px',
              maxWidth: '920px',
              fontWeight: 500,
              textWrap: 'balance',
            }}
          >
            From managing everything
            <br />
            to knowing what comes next.
          </h2>

          <p
            style={{
              fontSize: '1.12rem',
              lineHeight: 1.95,
              color: 'rgba(215,199,182,0.82)',
              margin: '0 auto 64px',
              maxWidth: '780px',
            }}
          >
            Anastasis coordinates the separate pieces of caring for yourself
            and turns them into clear daily direction.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '26px',
              maxWidth: '980px',
              margin: '0 auto 72px',
            }}
          >
            <div
              style={{
                background: 'rgba(18,18,18,0.56)',
                borderRadius: '34px',
                padding: '42px 34px',
                backdropFilter: 'blur(18px)',
                boxShadow: '0 24px 80px rgba(0,0,0,0.16)',
                textAlign: 'left',
              }}
            >
              <p
                style={{
                  letterSpacing: '4px',
                  fontSize: '11px',
                  color: '#c58b57',
                  opacity: 0.82,
                  margin: '0 0 20px',
                  textTransform: 'uppercase',
                }}
              >
                Before Anastasis
              </p>

              <h3
                style={{
                  fontSize: '1.48rem',
                  lineHeight: 1.35,
                  margin: '0 0 18px',
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                }}
              >
                You hold all the information and make every decision.
              </h3>

              <p
                style={{
                  fontSize: '1.02rem',
                  lineHeight: 1.9,
                  color: 'rgba(215,199,182,0.8)',
                  margin: 0,
                }}
              >
                You piece together workouts, meals, symptoms, recovery,
                appointments, supplements, goals, and advice—then try to
                determine what matters today.
              </p>
            </div>

            <div
              style={{
                background: 'rgba(18,18,18,0.56)',
                borderRadius: '34px',
                padding: '42px 34px',
                backdropFilter: 'blur(18px)',
                boxShadow: '0 24px 80px rgba(0,0,0,0.16)',
                textAlign: 'left',
              }}
            >
              <p
                style={{
                  letterSpacing: '4px',
                  fontSize: '11px',
                  color: '#c58b57',
                  opacity: 0.82,
                  margin: '0 0 20px',
                  textTransform: 'uppercase',
                }}
              >
                With Anastasis
              </p>

              <h3
                style={{
                  fontSize: '1.48rem',
                  lineHeight: 1.35,
                  margin: '0 0 18px',
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                }}
              >
                You receive the next best actions for your actual life.
              </h3>

              <p
                style={{
                  fontSize: '1.02rem',
                  lineHeight: 1.9,
                  color: 'rgba(215,199,182,0.8)',
                  margin: 0,
                }}
              >
                You open one platform, complete a check-in, and see what
                deserves attention based on what your body and life require
                now.
              </p>
            </div>
          </div>

          <div
            style={{
              maxWidth: '860px',
              margin: '0 auto',
              background: 'rgba(181,110,67,0.08)',
              border: '1px solid rgba(197,139,87,0.15)',
              borderRadius: '34px',
              padding: '38px 34px',
            }}
          >
            <p
              style={{
                fontSize: '1.12rem',
                lineHeight: 1.9,
                color: 'rgba(245,240,232,0.88)',
                margin: 0,
              }}
            >
              Less guessing. Fewer decisions. More consistency. More of your
              capacity available for the work, people, and life that matter to
              you.
            </p>
          </div>
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
              margin: '0 auto 42px',
              maxWidth: '920px',
              fontWeight: 500,
            }}
          >
            Assess.
            <br />
            Adapt.
            <br />
            Direct.
          </h2>

          <p
            style={{
              fontSize: '1.12rem',
              lineHeight: 1.95,
              color: 'rgba(215,199,182,0.82)',
              margin: '0 auto 90px',
              maxWidth: '790px',
            }}
          >
            You do not receive a static plan and get left alone to manage it.
            Anastasis continues interpreting your inputs and adjusting what
            happens next.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '26px',
              margin: '0 auto 90px',
            }}
          >
            {[
              {
                title: '1. Assess',
                body:
                  'The Capacity Audit identifies where your current system is strained, what is consuming capacity, and what should be addressed first.',
              },
              {
                title: '2. Adapt',
                body:
                  'Your training, nutrition, recovery, routines, and recommendations are shaped around your body, schedule, goals, symptoms, and real responsibilities.',
              },
              {
                title: '3. Direct',
                body:
                  'Daily check-ins give Anastasis updated context so it can show you what matters today, what has changed, and what can wait.',
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
              margin: '0 auto 90px',
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
                marginBottom: '20px',
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
                margin: '0 auto',
                maxWidth: '720px',
              }}
            >
              You check in. Anastasis evaluates what changed. Your priorities
              adjust. You execute what matters and leave the rest alone.
            </p>
          </div>

          <div
            style={{
              maxWidth: '900px',
              margin: '0 auto 90px',
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
              Built for high-capacity women
            </p>

            <h2
              style={{
                fontSize: 'clamp(2rem, 5vw, 3.8rem)',
                lineHeight: 1.1,
                letterSpacing: '-0.04em',
                margin: '0 auto 32px',
                maxWidth: '880px',
                fontWeight: 500,
                textWrap: 'balance',
              }}
            >
              Your life cannot revolve around managing your health.
            </h2>

            <p
              style={{
                fontSize: '1.08rem',
                lineHeight: 1.95,
                color: 'rgba(215,199,182,0.8)',
                margin: '0 auto',
                maxWidth: '760px',
              }}
            >
              Anastasis is for the woman building a business, leading a team,
              raising a family, pursuing demanding goals, or carrying
              responsibilities that require her capacity. She is not looking
              for more motivation. She is looking for a system capable of
              matching the complexity of her life.
            </p>
          </div>

          <div
            style={{
              maxWidth: '900px',
              margin: '0 auto',
              padding: '62px 34px',
              borderRadius: '38px',
              background:
                'radial-gradient(circle at top, rgba(181,110,67,0.14), rgba(18,18,18,0.52) 58%)',
              backdropFilter: 'blur(18px)',
              boxShadow: '0 30px 90px rgba(0,0,0,0.2)',
            }}
          >
            <p
              style={{
                letterSpacing: '6px',
                fontSize: '12px',
                color: '#c58b57',
                opacity: 0.82,
                marginBottom: '24px',
                textTransform: 'uppercase',
              }}
            >
              Your starting point
            </p>

            <h2
              style={{
                fontSize: 'clamp(2rem, 5vw, 3.7rem)',
                lineHeight: 1.1,
                letterSpacing: '-0.04em',
                margin: '0 auto 28px',
                maxWidth: '820px',
                fontWeight: 500,
                textWrap: 'balance',
              }}
            >
              Your body should not be another system you have to run alone.
            </h2>

            <p
              style={{
                fontSize: '1.08rem',
                lineHeight: 1.92,
                color: 'rgba(215,199,182,0.82)',
                margin: '0 auto 42px',
                maxWidth: '720px',
              }}
            >
              Complete the Capacity Audit to discover what Anastasis would
              prioritize, personalize, and begin managing with you.
            </p>

            <div
              style={{
                display: 'flex',
                gap: '18px',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              <TrackedButton
                href="/audit"
                event="audit_cta_clicked_3"
                properties={{ location: 'final_cta', page: 'landing' }}
              >
                Build My Personalized Plan
              </TrackedButton>

              <Button href="/program">Explore Anastasis</Button>
            </div>

            <p
              style={{
                margin: '28px auto 0',
                fontSize: '0.88rem',
                lineHeight: 1.7,
                color: 'rgba(215,199,182,0.56)',
              }}
            >
              Approximately 10 minutes · Personalized starting point · Clear
              recommendation
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
