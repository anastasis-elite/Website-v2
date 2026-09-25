import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Button from '../components/Button'
import MistReveal from '../components/MistReveal'
import TrackEvent from '@/components/TrackEvent'
import TrackedButton from '@/components/TrackedButton'
import { BRAND_NAME, BRAND_TITLE } from '@/lib/seo'

const homeDescription =
  'Anastasis brings your workouts, nutrition, recovery, symptoms, cycle, goals, and schedule together so you can understand what your body needs today.'

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

const eyebrowStyle: CSSProperties = {
  letterSpacing: '6px',
  fontSize: '12px',
  color: '#c58b57',
  opacity: 0.78,
  marginBottom: '28px',
  textTransform: 'uppercase',
}

const sectionStyle: CSSProperties = {
  padding: '100px 24px 120px',
  position: 'relative',
  zIndex: 2,
}

const sectionInnerStyle: CSSProperties = {
  maxWidth: '1020px',
  margin: '0 auto',
  textAlign: 'center',
}

const sectionTitleStyle: CSSProperties = {
  fontSize: 'var(--landing-section-title)',
  lineHeight: 1.08,
  letterSpacing: '0',
  margin: '0 auto 34px',
  maxWidth: '920px',
  fontWeight: 500,
  textWrap: 'balance',
}

const bodyStyle: CSSProperties = {
  maxWidth: '790px',
  margin: '0 auto',
  fontSize: 'var(--landing-body)',
  lineHeight: 1.9,
  color: 'rgba(215,199,182,0.82)',
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
  gap: '22px',
  maxWidth: '980px',
  margin: '0 auto',
}

const cardStyle: CSSProperties = {
  background: 'rgba(18,18,18,0.56)',
  borderRadius: '30px',
  padding: '32px 28px',
  backdropFilter: 'blur(18px)',
  boxShadow: '0 24px 80px rgba(0,0,0,0.16)',
  textAlign: 'left',
}

const cardTitleStyle: CSSProperties = {
  fontSize: '1.22rem',
  margin: '0 0 14px',
  fontWeight: 500,
  letterSpacing: '0',
  color: '#f5f0e8',
}

const cardTextStyle: CSSProperties = {
  fontSize: '1rem',
  lineHeight: 1.8,
  color: 'rgba(215,199,182,0.8)',
  margin: 0,
}

const heroQuestions = [
  'Should I train hard today?',
  'Do I need more recovery?',
  'What should I eat?',
  'Why am I exhausted?',
  'Am I doing enough?',
]

const auditOutcomes = [
  'What needs your attention now',
  'What may be making things harder',
  'What changes could make the biggest difference',
  'What you can stop worrying about for now',
]

const workSteps = [
  {
    title: '1. Check in',
    label: 'Assess',
    body:
      'Tell Anastasis how you’re feeling, how you slept, what’s sore, where you are in your cycle, what your schedule looks like, and anything else affecting your day.',
  },
  {
    title: '2. Your plan adjusts',
    label: 'Adapt',
    body:
      'Your workouts, nutrition, recovery, and daily priorities can change based on what’s actually happening—not what a generic plan assumed would happen.',
  },
  {
    title: '3. Know what to do next',
    label: 'Direct',
    body:
      'Open Anastasis and see what deserves your attention today.',
  },
]

const reliefStatements = [
  'No piecing together five apps.',
  'No trying to remember everything your trainer, nutrition coach, doctor, podcast, and Instagram told you.',
  'No treating every health goal like it has to be accomplished today.',
]

const womenCarry = [
  'Running a business.',
  'Leading a team.',
  'Raising kids.',
  'Managing a household.',
  'Chasing a big goal.',
  'Doing several of those at the same time.',
]

export default function Home() {
  return (
    <main
      className="landing-page"
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
                marginBottom: '12px',
                textTransform: 'uppercase',
              }}
            >
              Health & Performance Concierge
            </p>

            <p
              style={{
                maxWidth: '560px',
                margin: '0 auto',
                fontSize: '0.9rem',
                lineHeight: 1.7,
                color: 'rgba(215,199,182,0.66)',
              }}
            >
              One place to understand your workouts, food, recovery, symptoms,
              cycle, goals, and real life together.
            </p>
          </MistReveal>
        </div>

        <h1
          className="hero-headline-delay"
          style={{
            fontSize: 'var(--landing-hero-title)',
            lineHeight: 1.12,
            fontWeight: 400,
            maxWidth: '980px',
            margin: '64px auto 34px',
            letterSpacing: '0',
            textAlign: 'center',
            color: '#f5f0e8',
            textWrap: 'balance',
          }}
        >
          Stop trying to figure out what your body needs every day.
        </h1>

        <div
          style={{
            maxWidth: '790px',
            margin: '0 auto 34px',
            display: 'grid',
            gap: '18px',
          }}
        >
          <p
            style={{
              fontSize: 'var(--landing-body-large)',
              lineHeight: 1.8,
              color: 'rgba(215,199,182,0.9)',
              margin: 0,
              textWrap: 'balance',
            }}
          >
            You already have enough to manage.
          </p>

          <p
            style={{
              fontSize: 'var(--landing-body-large)',
              lineHeight: 1.85,
              color: 'rgba(215,199,182,0.82)',
              margin: 0,
              textWrap: 'balance',
            }}
          >
            Anastasis brings your workouts, nutrition, recovery, symptoms,
            cycle, goals, and schedule together—then helps you decide what to
            do today.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '12px',
            maxWidth: '860px',
            margin: '0 auto 34px',
            width: '100%',
          }}
        >
          {heroQuestions.map((question) => (
            <div
              key={question}
              style={{
                background: 'rgba(18,18,18,0.5)',
                border: '1px solid rgba(197,139,87,0.12)',
                borderRadius: '22px',
                padding: '18px 16px',
                color: 'rgba(245,240,232,0.9)',
                fontSize: '0.98rem',
                lineHeight: 1.45,
                boxShadow: '0 18px 60px rgba(0,0,0,0.13)',
              }}
            >
              {question}
            </div>
          ))}
        </div>

        <p
          style={{
            maxWidth: '720px',
            margin: '0 auto 44px',
            fontSize: '1.04rem',
            lineHeight: 1.8,
            color: 'rgba(197,139,87,0.9)',
          }}
        >
          You have one place helping you put the pieces together.
        </p>

        <div
          style={{
            display: 'flex',
            gap: '18px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginTop: '12px',
          }}
        >
          <TrackedButton
            href="/audit"
            event="audit_cta_clicked_1"
            properties={{ location: 'hero', page: 'landing' }}
          >
            See What My Body Needs
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
          <span>About 10 minutes</span>
          <span>One clear starting point</span>
          <span>Next step today</span>
        </div>

        <div style={{ height: '80px' }} />
      </section>

      <section id="outcome" style={sectionStyle}>
        <div style={sectionInnerStyle}>
          <p style={eyebrowStyle}>Capacity Audit</p>

          <h2 style={sectionTitleStyle}>
            You don’t have to fix everything at once.
          </h2>

          <div
            style={{
              ...bodyStyle,
              display: 'grid',
              gap: '22px',
              marginBottom: '56px',
            }}
          >
            <p style={{ margin: 0 }}>Start with a 10-minute assessment.</p>
            <p style={{ margin: 0 }}>
              We look at what’s going on with your energy, sleep, nutrition,
              training, recovery, symptoms, stress, schedule, and goals.
            </p>
            <p style={{ margin: 0 }}>Then we help you understand:</p>
          </div>

          <div style={{ ...gridStyle, marginBottom: '58px' }}>
            {auditOutcomes.map((item) => (
              <div key={item} style={cardStyle}>
                <p style={cardTextStyle}>{item}</p>
              </div>
            ))}
          </div>

          <TrackedButton
            href="/audit"
            event="audit_cta_clicked_2"
            properties={{ location: 'outcome', page: 'landing' }}
          >
            Find My Starting Point
          </TrackedButton>
        </div>
      </section>

      <section id="seen" style={sectionStyle}>
        <div style={{ ...sectionInnerStyle, maxWidth: '980px' }}>
          <p style={eyebrowStyle}>The real problem</p>

          <h2 style={sectionTitleStyle}>You already know the basics.</h2>

          <div
            style={{
              maxWidth: '790px',
              margin: '0 auto 52px',
              display: 'grid',
              gap: '18px',
              fontSize: '1.08rem',
              lineHeight: 1.85,
              color: 'rgba(215,199,182,0.82)',
            }}
          >
            <p style={{ margin: 0 }}>You know you should eat well.</p>
            <p style={{ margin: 0 }}>You know sleep matters.</p>
            <p style={{ margin: 0 }}>
              You know you need to move your body, manage stress, drink water,
              recover, and stay consistent.
            </p>
            <p
              style={{
                margin: '16px 0 0',
                color: 'rgba(245,240,232,0.92)',
                fontSize: '1.18rem',
              }}
            >
              Knowing isn’t the problem.
            </p>
            <p style={{ margin: 0 }}>
              The problem is figuring out what your body needs when you’re
              tired, sore, stressed, on your period, short on time, slept
              terribly, have a packed schedule—or all of the above.
            </p>
            <p style={{ margin: 0 }}>
              Most health and fitness plans tell you what to do.
            </p>
          </div>

          <div
            style={{
              maxWidth: '860px',
              margin: '0 auto 58px',
              background: 'rgba(181,110,67,0.08)',
              border: '1px solid rgba(197,139,87,0.15)',
              borderRadius: '34px',
              padding: '38px 34px',
            }}
          >
            <p
              style={{
                fontSize: 'var(--landing-moment)',
                lineHeight: 1.35,
                letterSpacing: '0',
                color: 'rgba(245,240,232,0.92)',
                margin: 0,
                textWrap: 'balance',
              }}
            >
              Anastasis helps determine what makes sense for you today.
            </p>
          </div>

          <Button href="#how-it-works">See How It Works</Button>
        </div>
      </section>

      <section
        id="how-it-works"
        style={{
          ...sectionStyle,
          paddingBottom: '140px',
        }}
      >
        <div
          style={{
            maxWidth: '1080px',
            margin: '0 auto',
            textAlign: 'center',
          }}
        >
          <p style={eyebrowStyle}>How it works</p>

          <h2
            style={{
              ...sectionTitleStyle,
              fontSize: 'var(--landing-hero-title)',
              lineHeight: 1.04,
            }}
          >
            How Anastasis works
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '18px',
              maxWidth: '920px',
              margin: '0 auto 76px',
            }}
          >
            {[
              'Tell us what’s going on.',
              'We put the pieces together.',
              'You get a clear next step.',
            ].map((step) => (
              <div
                key={step}
                style={{
                  background: 'rgba(18,18,18,0.56)',
                  borderRadius: '28px',
                  padding: '28px 24px',
                  color: 'rgba(245,240,232,0.9)',
                  fontSize: '1.12rem',
                  lineHeight: 1.55,
                  boxShadow: '0 24px 80px rgba(0,0,0,0.16)',
                }}
              >
                {step}
              </div>
            ))}
          </div>

          <div
            style={{
              ...gridStyle,
              gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
              marginBottom: '72px',
            }}
          >
            {workSteps.map((item) => (
              <div key={item.title} style={{ ...cardStyle, padding: '40px 34px' }}>
                <p
                  style={{
                    letterSpacing: '4px',
                    fontSize: '11px',
                    color: '#c58b57',
                    opacity: 0.82,
                    margin: '0 0 18px',
                    textTransform: 'uppercase',
                  }}
                >
                  {item.label}
                </p>

                <h3 style={{ ...cardTitleStyle, fontSize: '1.38rem' }}>
                  {item.title}
                </h3>

                <p style={cardTextStyle}>{item.body}</p>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gap: '16px',
              maxWidth: '860px',
              margin: '0 auto 64px',
            }}
          >
            {reliefStatements.map((item) => (
              <div
                key={item}
                style={{
                  background: 'rgba(18,18,18,0.46)',
                  borderRadius: '24px',
                  padding: '22px 26px',
                  color: 'rgba(215,199,182,0.84)',
                  fontSize: '1.02rem',
                  lineHeight: 1.65,
                }}
              >
                {item}
              </div>
            ))}
          </div>

          <div
            style={{
              maxWidth: '760px',
              margin: '0 auto',
              background: 'rgba(181,110,67,0.08)',
              border: '1px solid rgba(197,139,87,0.15)',
              borderRadius: '34px',
              padding: '38px 34px',
            }}
          >
            <p
              style={{
                fontSize: 'var(--landing-moment)',
                lineHeight: 1.35,
                color: 'rgba(245,240,232,0.92)',
                margin: 0,
                textWrap: 'balance',
              }}
            >
              Just: “Here’s what matters right now.”
            </p>
          </div>
        </div>
      </section>

      <section id="for-you" style={sectionStyle}>
        <div style={{ ...sectionInnerStyle, maxWidth: '980px' }}>
          <p style={eyebrowStyle}>Who it is for</p>

          <h2 style={sectionTitleStyle}>
            Built for women who already carry a lot.
          </h2>

          <div
            style={{
              ...gridStyle,
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              marginBottom: '54px',
            }}
          >
            {womenCarry.map((item) => (
              <div
                key={item}
                style={{
                  ...cardStyle,
                  padding: '24px 22px',
                  textAlign: 'center',
                }}
              >
                <p
                  style={{
                    ...cardTextStyle,
                    color: 'rgba(245,240,232,0.88)',
                  }}
                >
                  {item}
                </p>
              </div>
            ))}
          </div>

          <div
            style={{
              maxWidth: '780px',
              margin: '0 auto 54px',
              display: 'grid',
              gap: '20px',
              fontSize: '1.08rem',
              lineHeight: 1.85,
              color: 'rgba(215,199,182,0.82)',
            }}
          >
            <p style={{ margin: 0 }}>
              You want to feel strong, energized, healthy, and at home in your
              body.
            </p>
          </div>

          <div
            style={{
              maxWidth: '880px',
              margin: '0 auto 54px',
              padding: '44px 34px',
              borderRadius: '34px',
              background:
                'radial-gradient(circle at top, rgba(181,110,67,0.14), rgba(18,18,18,0.52) 62%)',
              boxShadow: '0 30px 90px rgba(0,0,0,0.2)',
            }}
          >
            <p
              style={{
                fontSize: 'var(--landing-large-moment)',
                lineHeight: 1.18,
                letterSpacing: '0',
                margin: 0,
                color: '#f5f0e8',
                textWrap: 'balance',
              }}
            >
              You just don’t want taking care of yourself to become another
              full-time job.
            </p>
          </div>

          <p
            style={{
              ...bodyStyle,
              color: 'rgba(197,139,87,0.9)',
            }}
          >
            That’s what Anastasis is built for.
          </p>
        </div>
      </section>

      <section
        id="start"
        style={{
          ...sectionStyle,
          paddingBottom: '140px',
        }}
      >
        <div style={sectionInnerStyle}>
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
            <p style={{ ...eyebrowStyle, opacity: 0.82 }}>
              Your starting point
            </p>

            <h2
              style={{
                fontSize: 'var(--landing-final-title)',
                lineHeight: 1.1,
                letterSpacing: '0',
                margin: '0 auto 28px',
                maxWidth: '820px',
                fontWeight: 500,
                textWrap: 'balance',
              }}
            >
              Your body shouldn’t be another thing you have to manage alone.
            </h2>

            <div
              style={{
                maxWidth: '720px',
                margin: '0 auto 42px',
                display: 'grid',
                gap: '18px',
                fontSize: '1.08rem',
                lineHeight: 1.85,
                color: 'rgba(215,199,182,0.82)',
              }}
            >
              <p style={{ margin: 0 }}>
                You don’t need another plan to follow perfectly.
              </p>
              <p style={{ margin: 0 }}>
                You need something that can look at the bigger picture and help
                you understand what your body needs, what matters today, and
                what can wait.
              </p>
              <p style={{ margin: 0 }}>Start with the Capacity Audit.</p>
              <p style={{ margin: 0 }}>
                In about 10 minutes, we’ll begin putting the pieces together.
              </p>
            </div>

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
                Show Me Where to Start
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
              About 10 minutes · Clear starting point · One next step
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
