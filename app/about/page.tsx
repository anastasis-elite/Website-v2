import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Button from '@/components/Button'
import MistReveal from '@/components/MistReveal'
import TrackEvent from '@/components/TrackEvent'
import TrackedButton from '@/components/TrackedButton'
import { BRAND_NAME } from '@/lib/seo'

const aboutDescription =
  'Learn how Anastasis uses your goals, assessments, check-ins, and recorded activity to bring training, nutrition, recovery, and daily priorities into view.'

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
  'Some days you feel rested and ready to train.',
  'Some days the kids were up all night.',
  'Some weeks leave more room for training than others.',
  'Your energy changes.',
  'Your recovery changes.',
  'Your cycle changes.',
  'Your schedule changes.',
  'What fits today may be different from what fit yesterday.',
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
            Your training sits alongside work, sleep, meals, relationships,
            recovery, and the rest of your day.
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
            Having those parts of your life in view can make the next decision clearer.
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
            Anastasis was built around a simple idea: your goals deserve a
            place in the life you already have. Your circumstances, assessments,
            and check-ins help shape a plan you can review and act on.
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
              A different day can call for a different approach.
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
              It takes attention to keep track of the different parts of a full day.
            </p>
            <p style={{ margin: 0 }}>
              You might have a workout to follow, nutrition targets to review,
              appointments to keep, and recent activity you want to remember.
            </p>
            <p style={{ margin: 0 }}>
              The useful question is how that information can help you choose
              what to do next.
            </p>
            <p style={{ margin: 0 }}>
              Anastasis brings your plan and the information you record into one dashboard.
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
                A next step you can consider alongside the day ahead.
              </p>
            </div>
          </div>

          <p style={bodyStyle}>
            Your goals, assessments, check-ins, and recorded activity provide
            context for training and recovery guidance. Nutrition features vary
            by program. EMBER focuses on calories, macros, and hydration; it
            does not include food or meal logging, or micronutrient tracking or guidance.
          </p>
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={{ ...sectionInnerStyle, maxWidth: '980px' }}>
          <p style={eyebrowStyle}>Less to carry</p>

          <h2 style={sectionTitleStyle}>Make room for the decisions that matter.</h2>

          <div
            style={{
              ...bodyStyle,
              display: 'grid',
              gap: '18px',
              marginBottom: '58px',
            }}
          >
            <p style={{ margin: 0 }}>
              A full life already asks you to make plenty of decisions.
              Looking after yourself deserves a place in it without every
              choice becoming a project.
            </p>
            <p style={{ margin: 0 }}>
              Anastasis gives your plan, check-ins, and recorded progress a place to stay together.
            </p>
            <p style={{ margin: 0 }}>
              You can review your assigned workout, nutrition targets, and recovery options.
            </p>
            <p style={{ margin: 0 }}>
              The guidance uses the goals, circumstances, and inputs you share.
              You decide how to make room for the next step.
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
              More clarity. A manageable next step. Room for the rest of your life.
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
              My work in fitness and nutrition kept bringing me back to one question:
            </p>
            <p style={{ margin: 0 }}>
              How can a useful plan account for the woman following it?
            </p>
            <p style={{ margin: 0 }}>
              A workout has to find its place alongside sleep, work, and other commitments.
            </p>
            <p style={{ margin: 0 }}>
              Nutrition guidance has to consider the information a woman can
              share about her goals and circumstances.
            </p>
            <p style={{ margin: 0 }}>
              Recovery guidance needs to lead to options she can understand and review.
            </p>
            <p style={{ margin: 0 }}>
              And the plan needs room for circumstances to change.
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
              With goals and needs of their own.
            </p>
            <p style={{ ...bodyStyle, marginBottom: '18px' }}>
              I wanted the information a woman shares about her life to matter
              in the structure of her plan.
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
              That perspective is the starting point for Anastasis.
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
              <p style={{ margin: 0 }}>Your goals give the plan direction.</p>
              <p style={{ margin: 0 }}>Your circumstances give it context.</p>
              <p style={{ margin: 0 }}>
                Your check-ins and recorded activity help keep that context current.
              </p>
              <p style={{ margin: 0 }}>
                Review your plan, see what you have recorded, and choose a
                manageable next step as your day changes.
              </p>
              <p style={{ margin: 0 }}>
                The Capacity Audit offers a suggested starting program from
                five brief questions. Member onboarding gathers the detail for your plan.
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
