import Link from 'next/link'
import * as styles from '../styles/globalstyles'
import TrackEvent from '@/components/TrackEvent'

export default function WhyPage() {
  return (
    <>
      <TrackEvent event="why_page_viewed" properties={{ page: 'why' }} />

      <main style={styles.pageStyle}>
        <section style={styles.h1Style}>
          <p style={styles.eyebrowStyle}>Why You Keep Starting Over</p>

          <h1>
            It's probably not because you're lazy, unmotivated, or lacking
            discipline.
          </h1>

          <p style={styles.heroTextStyle}>
            Most women don't need another plan.
            <br />
            <br />
            They need enough capacity to actually follow one.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2>The Problem Was Never Motivation</h2>

          <p>
            You've downloaded the meal plans.
          </p>

          <p>
            You've bought the programs.
          </p>

          <p>
            You've promised yourself that this time would be different.
          </p>

          <p>
            And for a while, it usually is.
          </p>

          <p>
            Until life gets heavy.
          </p>

          <p>
            The kids need something.
          </p>

          <p>
            Work gets stressful.
          </p>

          <p>
            Someone gets sick.
          </p>

          <p>
            Sleep disappears.
          </p>

          <p>
            And suddenly the things that were helping you feel like yourself
            become the first things sacrificed.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2>Most Programs Ignore Capacity</h2>

          <p>
            Traditional wellness programs assume you have unlimited energy,
            unlimited time, and unlimited mental bandwidth.
          </p>

          <p>
            Real life doesn't work like that.
          </p>

          <p>
            Especially for women carrying careers, households, relationships,
            children, appointments, responsibilities, and everyone else's needs.
          </p>

          <p>
            When your capacity drops, your ability to execute drops with it.
          </p>

          <p>
            That isn't failure.
          </p>

          <p>
            That's reality.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2>Your Body Has Been Telling The Story All Along</h2>

          <div style={styles.cardGridStyle}>
            {[
              'Chronic fatigue',
              'Stress eating',
              'Poor recovery',
              'Constant restarts',
              'Hormonal symptoms',
              'Feeling disconnected from yourself',
            ].map((item) => (
              <div key={item} style={styles.cardStyle}>
                {item}
              </div>
            ))}
          </div>

          <p style={{ marginTop: '24px' }}>
            None of these happen in isolation.
          </p>

          <p>
            Your body adapts to the environment it lives in.
          </p>

          <p>
            If the environment is chaotic, overloaded, exhausted, and running on
            survival mode, your body eventually reflects that reality.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2>So We Built Something Different</h2>

          <p>
            Anastasis wasn't designed around punishment.
          </p>

          <p>
            It wasn't designed around perfection.
          </p>

          <p>
            And it wasn't designed for the woman whose entire life revolves
            around fitness.
          </p>

          <p>
            It was built for the woman carrying everything.
          </p>

          <p>
            The woman trying to hold her family together.
          </p>

          <p>
            The woman trying to take care of herself without abandoning everyone
            else.
          </p>

          <p>
            The woman who misses who she used to be.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2>The Goal Isn't Weight Loss</h2>

          <p>
            Weight loss may happen.
          </p>

          <p>
            Strength may happen.
          </p>

          <p>
            Better energy may happen.
          </p>

          <p>
            Better recovery may happen.
          </p>

          <p>
            But the real goal is bigger than that.
          </p>

          <p>
            The goal is helping you build enough capacity to consistently show
            up for the life you want.
          </p>

          <p>
            Because the woman you miss is still there.
          </p>

          <p>
            She doesn't need more punishment.
          </p>

          <p>
            She needs support.
          </p>
        </section>

        <section style={styles.sectionStyle}>
          <h2>Start With Your Capacity</h2>

          <p>
            Take the Capacity Audit and discover what may actually be holding
            you back.
          </p>

          <Link href="/apply" style={styles.primaryButtonStyle}>
            Take the Capacity Audit
          </Link>
        </section>
      </main>
    </>
  )
}
