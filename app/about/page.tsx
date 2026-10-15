import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Button from '@/components/Button'
import MistReveal from '@/components/MistReveal'
import TrackEvent from '@/components/TrackEvent'
import TrackedButton from '@/components/TrackedButton'
import { BRAND_NAME } from '@/lib/seo'

const aboutDescription =
  'Learn why Anastasis was built for real life, connecting training, nutrition, recovery, readiness, symptoms, cycle, assessments, and daily inputs into one supportive system.'

export const metadata: Metadata = {
  title: 'About Anastasis',
  description: aboutDescription,
  alternates: {
    canonical: '/about',
  },
  openGraph: {
    title: 'About Anastasis',
    description: aboutDescription,
    url: '/about',
    siteName: BRAND_NAME,
  },
  twitter: {
    card: 'summary',
    title: 'About Anastasis',
    description: aboutDescription,
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
  border: '1px solid rgba(197,139,87,0.12)',
  borderRadius: '30px',
  padding: '32px 28px',
  backdropFilter: 'blur(18px)',
  boxShadow: '0 24px 80px rgba(0,0,0,0.16)',
  textAlign: 'left',
}

const cardTextStyle: CSSProperties = {
  fontSize: '1rem',
  lineHeight: 1.8,
  color: 'rgba(215,199,182,0.8)',
  margin: 0,
}

const realLifeChanges = [
  'Some days you slept eight hours and you’re ready to push.',
  'Some days the kids were up all night.',
  'Some weeks training is consistent. Others aren’t.',
  'Your energy changes.',
  'Your recovery changes.',
  'Your cycle changes.',
  'Your schedule changes.',
  'What your body can handle today may not be what it could handle yesterday.',
]

const systemPieces = [
  'Training',
  'Nutrition',
  'Recovery',
  'Readiness',
  'Cycle',
  'Symptoms',
  'Assessments',
  'Daily Life',
]

const founderLife = [
  'Raising children.',
  'Building careers.',
  'Running businesses.',
  'Managing households.',
  'Navigating relationships.',
  'Taking care of other people.',
]

export default function AboutPage() {
  return (
    <main
      className="landing-page"
      style={{
        minHeight: '100vh',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <TrackEvent event="about_page_viewed" properties={{ page: 'about' }} />

      <section
        style={{
          width: '100%',
          maxWidth: '980px',
          textAlign: 'center',
          margin: '0 auto',
          padding: '72px 24px 118px',
          minHeight: '92vh',
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

        <MistReveal>
          <Image
            src="/Logo.png"
            alt="Anastasis"
            width={150}
            height={150}
            priority
            style={{
              margin: '0 auto 24px',
              display: 'block',
              opacity: 0.9,
              filter: 'drop-shadow(0 0 38px rgba(181,110,67,0.16))',
            }}
          />

          <p style={eyebrowStyle}>About Anastasis</p>
        </MistReveal>

        <h1
          className="hero-headline-delay"
          style={{
            fontSize: 'var(--landing-hero-title)',
            lineHeight: 1.12,
            fontWeight: 400,
            maxWidth: '980px',
            margin: '0 auto 34px',
            letterSpacing: '0',
            textAlign: 'center',
            color: '#f5f0e8',
            textWrap: 'balance',
          }}
        >
          Built for real life.
        </h1>

        <div
          style={{
            maxWidth: '790px',
            margin: '0 auto 40px',
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
            Your body doesn’t experience your workout, nutrition, sleep, stress,
            cycle, recovery, and schedule separately.
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
            Neither should the system helping you manage them.
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
            Anastasis was built around a simple idea: your health and
            performance support should adapt to the life you’re actually
            living—not require you to build your life around a perfect plan.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px',
            maxWidth: '820px',
            margin: '0 auto',
            width: '100%',
          }}
        >
          {['Life today', 'Body today', 'Direction today'].map((item) => (
            <div
              key={item}
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
              {item}
            </div>
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={sectionInnerStyle}>
          <p style={eyebrowStyle}>Real life changes</p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '14px',
              maxWidth: '980px',
              margin: '0 auto 54px',
            }}
          >
            {realLifeChanges.map((item, index) => (
              <div
                key={item}
                style={{
                  ...cardStyle,
                  padding: index === 7 ? '34px 28px' : '24px 22px',
                  textAlign: 'center',
                  background:
                    index === 7
                      ? 'radial-gradient(circle at top, rgba(181,110,67,0.14), rgba(18,18,18,0.52) 62%)'
                      : 'rgba(18,18,18,0.46)',
                }}
              >
                <p
                  style={{
                    ...cardTextStyle,
                    color:
                      index === 7
                        ? 'rgba(245,240,232,0.92)'
                        : 'rgba(215,199,182,0.82)',
                  }}
                >
                  {item}
                </p>
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
                margin: '0 0 12px',
                textWrap: 'balance',
              }}
            >
              That isn’t failure.
            </p>
            <p
              style={{
                fontSize: 'var(--landing-moment)',
                lineHeight: 1.35,
                color: 'rgba(197,139,87,0.92)',
                margin: 0,
                textWrap: 'balance',
              }}
            >
              That’s real life.
            </p>
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={{ ...sectionInnerStyle, maxWidth: '1080px' }}>
          <p style={eyebrowStyle}>The whole picture</p>

          <h2 style={sectionTitleStyle}>One woman. One connected system.</h2>

          <div
            style={{
              ...bodyStyle,
              display: 'grid',
              gap: '18px',
              marginBottom: '64px',
            }}
          >
            <p style={{ margin: 0 }}>
              Most health and fitness tools solve one piece at a time.
            </p>
            <p style={{ margin: 0 }}>
              A workout app knows your workouts. A nutrition tracker knows your
              food. A recovery device knows your sleep. A cycle tracker knows
              where you are in your cycle.
            </p>
            <p style={{ margin: 0 }}>
              But you’re still the person responsible for taking all of that
              information and figuring out what to actually do with it.
            </p>
            <p style={{ margin: 0 }}>
              Anastasis was designed to connect those pieces.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr)',
              gap: '22px',
              maxWidth: '980px',
              margin: '0 auto 54px',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '12px',
              }}
            >
              {systemPieces.map((piece) => (
                <div
                  key={piece}
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
                  {piece}
                </div>
              ))}
            </div>

            <div
              aria-hidden="true"
              style={{
                width: 'min(620px, 100%)',
                height: '1px',
                margin: '8px auto',
                background:
                  'linear-gradient(90deg, transparent, rgba(197,139,87,0.4), transparent)',
              }}
            />

            <div
              style={{
                maxWidth: '760px',
                margin: '0 auto',
                padding: '38px 34px',
                borderRadius: '34px',
                background:
                  'radial-gradient(circle at top, rgba(181,110,67,0.14), rgba(18,18,18,0.52) 62%)',
                boxShadow: '0 30px 90px rgba(0,0,0,0.2)',
              }}
            >
              <p
                style={{
                  fontSize: 'var(--landing-moment)',
                  lineHeight: 1.35,
                  color: 'rgba(245,240,232,0.92)',
                  margin: '0 0 16px',
                  textWrap: 'balance',
                }}
              >
                What makes sense for today.
              </p>
              <p style={{ ...cardTextStyle, textAlign: 'center' }}>
                Not an imaginary perfect Tuesday. Your Tuesday.
              </p>
            </div>
          </div>

          <p style={bodyStyle}>
            Your training, nutrition, recovery, readiness, symptoms, cycle,
            assessments, and daily inputs work together to help shape what makes
            sense for today.
          </p>
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={{ ...sectionInnerStyle, maxWidth: '980px' }}>
          <p style={eyebrowStyle}>Less to carry</p>

          <h2 style={sectionTitleStyle}>You don’t need more capacity.</h2>

          <div
            style={{
              ...bodyStyle,
              display: 'grid',
              gap: '18px',
              marginBottom: '58px',
            }}
          >
            <p style={{ margin: 0 }}>
              Women are constantly being handed another thing to track, another
              habit to perfect, another routine to follow, and another standard
              they’re somehow supposed to fit into an already full life.
            </p>
            <p style={{ margin: 0 }}>
              Anastasis isn’t designed to add another responsibility.
            </p>
            <p style={{ margin: 0 }}>
              It’s designed to reduce the number of decisions you’re carrying.
            </p>
            <p style={{ margin: 0 }}>
              You give the system information about what’s actually happening.
              Anastasis helps turn that information into direction.
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
                fontSize: 'var(--landing-large-moment)',
                lineHeight: 1.18,
                letterSpacing: '0',
                margin: 0,
                color: '#f5f0e8',
                textWrap: 'balance',
              }}
            >
              Women don’t need more capacity. They need refined resilience.
            </p>
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={{ ...sectionInnerStyle, maxWidth: '980px' }}>
          <p style={eyebrowStyle}>Founder perspective</p>

          <h2 style={sectionTitleStyle}>Why Anastasis exists</h2>

          <div
            style={{
              maxWidth: '790px',
              margin: '0 auto 54px',
              display: 'grid',
              gap: '18px',
              fontSize: 'var(--landing-body)',
              lineHeight: 1.9,
              color: 'rgba(215,199,182,0.82)',
              textAlign: 'left',
            }}
          >
            <p style={{ margin: 0 }}>
              I spent years working in fitness and nutrition and kept seeing the
              same problem:
            </p>
            <p style={{ margin: 0 }}>
              The individual pieces could be good—and still fail to account for
              the whole woman.
            </p>
            <p style={{ margin: 0 }}>
              A perfectly written workout doesn’t exist in isolation from poor
              sleep.
            </p>
            <p style={{ margin: 0 }}>
              Nutrition doesn’t exist separately from energy, recovery,
              symptoms, or a woman’s cycle.
            </p>
            <p style={{ margin: 0 }}>
              Recovery isn’t useful as a score if you still have to figure out
              what that score means for your day.
            </p>
            <p style={{ margin: 0 }}>
              And real women aren’t living inside controlled environments where
              every variable stays the same.
            </p>
          </div>

          <div
            style={{
              ...gridStyle,
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              marginBottom: '54px',
            }}
          >
            {founderLife.map((item) => (
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
              maxWidth: '820px',
              margin: '0 auto',
              background: 'rgba(181,110,67,0.08)',
              border: '1px solid rgba(197,139,87,0.15)',
              borderRadius: '34px',
              padding: '38px 34px',
            }}
          >
            <p style={{ ...bodyStyle, marginBottom: '18px' }}>
              And still trying to take care of themselves.
            </p>
            <p style={{ ...bodyStyle, marginBottom: '18px' }}>
              I didn’t want to build another program that demanded women become
              better at fitting themselves into the system.
            </p>
            <p
              style={{
                fontSize: 'var(--landing-moment)',
                lineHeight: 1.35,
                color: 'rgba(245,240,232,0.92)',
                margin: 0,
                textWrap: 'balance',
              }}
            >
              I wanted to build the system around them.
            </p>
            <p
              style={{
                margin: '18px 0 0',
                color: 'rgba(197,139,87,0.92)',
                fontSize: '1.04rem',
                lineHeight: 1.8,
              }}
            >
              That’s Anastasis.
            </p>
          </div>
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
              Built around the woman
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
              Built around the woman who’s actually living the life.
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
              <p style={{ margin: 0 }}>Not perfection.</p>
              <p style={{ margin: 0 }}>Not endless optimization.</p>
              <p style={{ margin: 0 }}>
                Not another rigid plan waiting to tell you that you fell behind.
              </p>
              <p style={{ margin: 0 }}>
                A system that learns from your inputs, recognizes patterns, and
                helps you make more informed decisions as your life and body
                change.
              </p>
              <p style={{ margin: 0 }}>
                Because thriving shouldn’t require life to stop being
                complicated first.
              </p>
            </div>

            <p
              style={{
                fontSize: 'var(--landing-moment)',
                lineHeight: 1.35,
                color: 'rgba(245,240,232,0.92)',
                margin: '0 auto 42px',
                maxWidth: '760px',
                textWrap: 'balance',
              }}
            >
              Your life changes.
              <br />
              Your body changes.
              <br />
              Your support should be able to change with you.
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
                event="audit_cta_clicked_about"
                properties={{ location: 'final_cta', page: 'about' }}
              >
                Show Me Where to Start
              </TrackedButton>

              <Button href="/program">Explore Anastasis</Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
