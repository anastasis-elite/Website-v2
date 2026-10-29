import { CAPACITY_AUDIT_TIME } from '@/lib/capacityAudit'
import type { CSSProperties } from 'react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Button from '../components/Button'
import MistReveal from '../components/MistReveal'
import HomepageAnalytics from '@/components/homepage/HomepageAnalytics'
import styles from './homepage.module.css'
import { BRAND_NAME, BRAND_TITLE } from '@/lib/seo'

const homeDescription =
  'Make room for your health with training plans, nutrition targets, recovery guidance, and recorded progress informed by your goals, circumstances, and check-ins.'

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
  'What fits my energy today?',
  'Would recovery be useful?',
  'Where does nutrition fit?',
  'What deserves my attention?',
  'What can wait?',
]

const auditOutcomes = [
  'A suggested program to explore',
  'The support level that may fit your current season',
  'What each program includes',
  'A starting point you can review in your own time',
]

const storyMoments = [
  {
    title: 'The good morning',
    lead: 'You wake up feeling great.',
    body: 'Your training plan is ready. You know what you’re working on, and your nutrition targets are in the same place.',
  },
  {
    title: 'The disrupted afternoon',
    lead: 'The day doesn’t go according to plan.',
    body: 'You check in, review your options, and decide what fits instead of trying to reconstruct your entire routine from memory.',
  },
  {
    title: 'The recovery evening',
    lead: 'You need recovery more than another workout.',
    body: 'Recovery guidance has a place alongside your training—not as something you have to earn by pushing harder.',
  },
]

const productFeatures = [
  { title: 'Training', body: 'Your assessed plan, exercise guidance, and recorded workouts.' },
  { title: 'Nutrition', body: 'Targets and food tools appropriate to your program.' },
  { title: 'Recovery', body: 'Guidance informed by your recorded recovery context.' },
  { title: 'Progress', body: 'A history of the work you’ve done and the changes you’ve recorded.' },
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
      className={`landing-page ${styles.page}`}
      style={{
        minHeight: '100vh',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <HomepageAnalytics />

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
              Training, nutrition targets, recovery guidance, and progress together.
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
          You carry enough. Your health shouldn’t be one more thing you have to figure out.
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
              lineHeight: 1.85,
              color: 'rgba(215,199,182,0.82)',
              margin: 0,
              textWrap: 'balance',
            }}
          >
            You know what you want for your body. You’ve probably researched the
            workouts, saved the recipes, and promised yourself you’d get consistent
            when things settle down.
          </p>
          <p style={{ ...bodyStyle, margin: 0, fontSize: 'var(--landing-body-large)', lineHeight: 1.85, textWrap: 'balance' }}>
            But somehow, figuring out how to take care of yourself keeps becoming
            another thing on your list.
          </p>
          <p style={{ ...bodyStyle, margin: 0, fontSize: 'var(--landing-body-large)', lineHeight: 1.85, textWrap: 'balance' }}>
            Anastasis brings your training, nutrition, recovery, and progress into
            one personalized system—built around the life you’re actually living.
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
          A clear starting point. Room to continue.
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
          <div data-homepage-audit-cta="hero">
            <Button href="/audit">Find My Starting Point</Button>
          </div>

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
          <span>{CAPACITY_AUDIT_TIME}</span>
          <span>A suggested starting program</span>
          <span>Explore at your own pace</span>
        </div>

        <div style={{ height: '80px' }} />
      </section>

      <section id="story" aria-labelledby="story-title" style={sectionStyle}>
        <div style={sectionInnerStyle}>
          <p style={eyebrowStyle}>A familiar moment</p>
          <h2 id="story-title" style={sectionTitleStyle}>It’s 9 p.m. You finally have a minute.</h2>
          <div className={styles.storyGrid}>
            <div className={styles.prose} style={bodyStyle}>
              <p>You were going to work out today.</p>
              <p>You even thought about it three different times.</p>
              <p>But then the meeting ran long. Dinner needed making. Something came up that couldn’t wait.</p>
              <p>Now you’re standing in the kitchen wondering whether a workout is even worth starting this late.</p>
              <p>So you tell yourself you’ll do it tomorrow.</p>
              <p>And tomorrow, you’ll have to figure it all out again.</p>
            </div>
            <div className={styles.storyImage}>
              <Image
                src="/images/homepage/evening-kitchen.webp"
                alt="A woman in everyday clothes pauses thoughtfully at her kitchen counter in warm evening light."
                width={1536}
                height={1024}
                sizes="(max-width: 760px) calc(100vw - 48px), (max-width: 1068px) 46vw, 486px"
                loading="lazy"
                style={{ display: 'block', width: '100%', height: 'auto' }}
              />
            </div>
          </div>
          <p style={{ ...bodyStyle, marginTop: '48px', color: '#f5f0e8', fontSize: 'var(--landing-moment)', lineHeight: 1.35, textWrap: 'balance' }}>
            That’s the part Anastasis is designed to change.
          </p>
          <p style={{ ...bodyStyle, marginTop: '24px' }}>
            Not by demanding another hour from your day. By helping you understand what makes sense with the time, energy, and recovery you actually have.
          </p>
        </div>
      </section>

      <section id="outcome" style={sectionStyle}>
        <div style={sectionInnerStyle}>
          <p style={eyebrowStyle}>Capacity Audit</p>

          <h2 style={sectionTitleStyle}>
            You can begin with the room you have.
          </h2>

          <div
            style={{
              ...bodyStyle,
              display: 'grid',
              gap: '22px',
              marginBottom: '56px',
            }}
          >
            <p style={{ margin: 0 }}>Start with five brief questions.</p>
            <p style={{ margin: 0 }}>
              Share your energy, available time, support, and current season. The Capacity Audit suggests a program to explore. Member onboarding then gathers the detail used for your starting plan.
            </p>
            <p style={{ margin: 0 }}>Use it to find:</p>
          </div>

          <div style={{ ...gridStyle, marginBottom: '58px' }}>
            {auditOutcomes.map((item) => (
              <div key={item} style={cardStyle}>
                <p style={cardTextStyle}>{item}</p>
              </div>
            ))}
          </div>

          <div data-homepage-audit-cta="outcome">
            <Button href="/audit">Find My Starting Point</Button>
          </div>
        </div>
      </section>

      <section id="how-it-works" style={{ ...sectionStyle, paddingBottom: '140px' }}>
        <div style={{ ...sectionInnerStyle, maxWidth: '1080px' }}>
          <p style={eyebrowStyle}>How it works</p>
          <h2 style={sectionTitleStyle}>What if you didn’t have to figure it all out every morning?</h2>
          <div style={{ ...gridStyle, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))' }}>
            {storyMoments.map((moment) => (
              <div key={moment.title} style={cardStyle}>
                <h3 style={cardTitleStyle}>{moment.title}</h3>
                <p style={{ ...cardTextStyle, marginBottom: '18px', color: '#f5f0e8' }}>{moment.lead}</p>
                <p style={cardTextStyle}>{moment.body}</p>
              </div>
            ))}
          </div>
          <p style={{ ...bodyStyle, marginTop: '48px', textWrap: 'balance' }}>
            Anastasis doesn’t live in an imaginary world where every day goes perfectly. Neither do you.
          </p>
        </div>
      </section>

      <section id="seen" style={sectionStyle}>
        <div style={sectionInnerStyle}>
          <p style={eyebrowStyle}>Together, with context</p>
          <h2 style={sectionTitleStyle}>One place for the things you’ve been trying to piece together.</h2>
          <div style={gridStyle}>
            {productFeatures.map((feature) => (
              <div key={feature.title} style={cardStyle}>
                <h3 style={cardTitleStyle}>{feature.title}</h3>
                <p style={cardTextStyle}>{feature.body}</p>
              </div>
            ))}
          </div>
          <p style={{ ...cardTextStyle, margin: '28px auto 0', maxWidth: '680px' }}>
            Tools and guidance vary by program. <a className={styles.textLink} href="/program">Compare support levels</a> to find your starting point.
          </p>
          <div style={{ marginTop: '38px' }}>
            <Button href="#how-it-works">See How It Works</Button>
          </div>
        </div>
      </section>

      <section id="founder" aria-labelledby="founder-title" style={sectionStyle}>
        <div style={sectionInnerStyle}>
          <p style={eyebrowStyle}>From the founder</p>
          <h2 id="founder-title" style={sectionTitleStyle}>I didn’t build Anastasis because women needed another workout plan.</h2>
          <div className={styles.founderGrid}>
            {/* Reserved for an approved authentic founder photograph. No synthetic likeness. */}
            <div className={styles.founderPortrait} role="img" aria-label="Founder portrait placeholder; authentic photograph to be added.">
              <span style={eyebrowStyle}>Founder portrait</span>
              <span style={{ ...cardTitleStyle, margin: 0 }}>Rhea Nyx Anastasia</span>
              <span style={{ ...cardTextStyle, marginTop: '12px' }}>Photograph to come</span>
            </div>
            <div className={styles.prose} style={bodyStyle}>
              <p>I became a personal trainer and nutrition coach because I wanted to understand the questions I couldn’t find satisfying answers to.</p>
              <p>And the more women I worked with, the more obvious something became.</p>
              <p>A workout could look perfect on paper and still be completely wrong for the woman trying to fit it into her life.</p>
              <p>Her schedule mattered. Her recovery mattered. Her training history mattered. What was happening outside the gym mattered.</p>
              <p>I kept seeing how much time women spent trying to piece everything together.</p>
              <p>The workouts. The food. The progress. The adjustments.</p>
              <p>And I kept coming back to the same question:</p>
              <p style={{ color: '#f5f0e8' }}>Why are we expecting women to manage all of that by themselves?</p>
              <p>So I started building something different.</p>
              <p style={{ ...cardTextStyle, color: '#c58b57', marginTop: '12px' }}>Rhea Nyx Anastasia — NASM Certified Personal Trainer &amp; Certified Nutrition Coach</p>
            </div>
          </div>
        </div>
      </section>

      <section id="community" aria-labelledby="community-title" style={sectionStyle}>
        <div style={sectionInnerStyle}>
          <p style={eyebrowStyle}>A community we’re building</p>
          <h2 id="community-title" style={sectionTitleStyle}>And you don’t have to do it alone.</h2>
          <div className={styles.prose} style={bodyStyle}>
            <p>You know that feeling when you finally notice something changing?</p>
            <p>Maybe you caught your reflection and did a double take. Maybe you lifted more than you ever thought you could. Maybe you simply made it through a month of keeping a promise to yourself.</p>
            <p>Those moments deserve to be celebrated.</p>
            <p>We’re building the Anastasis community around women sharing their progress, supporting each other, and celebrating what it took to get there.</p>
            <p style={{ color: '#f5f0e8' }}>Every first of the month, we show up for each other.</p>
          </div>
          <div style={{ ...cardStyle, maxWidth: '790px', margin: '38px auto 0', textAlign: 'center', border: '1px solid rgba(197,139,87,0.15)' }}>
            <p style={cardTextStyle}>You’re invited to make a monthly progress update part of your own rhythm. A few words about your month, a personal story, or an optional progress photo—choose what feels right for you.</p>
            <p style={{ ...cardTextStyle, marginTop: '18px' }}>This is our community vision. In-app posting and photo sharing are not yet available.</p>
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
            Anastasis is designed to make those choices more manageable.
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
              You have a life you’re building. Your health belongs in it.
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
                Not someday, when everything settles down. Not after you’ve figured out every detail.
              </p>
              <p style={{ margin: 0 }}>
                Start with the woman you are, the goals you have, and the time you can make available.
              </p>
              <p style={{ margin: 0 }}>Start with the Capacity Audit.</p>
              <p style={{ margin: 0 }}>
                {CAPACITY_AUDIT_TIME}. Answer five questions and receive a suggested starting program.
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
              <div data-homepage-audit-cta="final_cta">
                <Button href="/audit">Show Me Where to Start</Button>
              </div>

              <Button href="/program">Compare support levels</Button>
            </div>

            <p
              style={{
                margin: '28px auto 0',
                fontSize: '0.88rem',
                lineHeight: 1.7,
                color: 'rgba(215,199,182,0.56)',
              }}
            >
              {CAPACITY_AUDIT_TIME} · Clear starting point · One next step
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
