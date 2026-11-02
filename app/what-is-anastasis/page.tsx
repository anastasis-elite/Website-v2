import type { Metadata } from 'next'
import Button from '@/components/Button'
import TrackEvent from '@/components/TrackEvent'
import { BRAND_NAME, absoluteUrl } from '@/lib/seo'
import styles from '../styles/publicEditorial.module.css'

const description = 'Anastasis brings your workouts, nutrition, recovery, and progress into one place—with personal guidance that helps you know where to begin and what to focus on.'

export const metadata: Metadata = {
  title: { absolute: 'What is Anastasis? | Anastasis' },
  description,
  alternates: { canonical: '/what-is-anastasis' },
  openGraph: { title: 'What is Anastasis?', description, url: '/what-is-anastasis', siteName: BRAND_NAME },
  twitter: { card: 'summary', title: 'What is Anastasis? | Anastasis', description },
}

const practicalSupport = [
  { title: 'Walk into your workout knowing where to start.', body: 'A personal training plan gives you exercises, sets, and repetitions, with a place to record your work.' },
  { title: 'Give your nutrition a clearer direction.', body: 'Keep your nutrition and water targets together, with additional food tools available as your level of support grows.' },
  { title: 'Make room for recovery.', body: 'Bring how you’re feeling into the picture, with guidance that helps you consider when rest or a gentler day may be useful.' },
  { title: 'See the progress you might otherwise miss.', body: 'Return to your workouts, measurements, and progress records to see what has changed beyond how you feel in a single moment.' },
]

export default function WhatIsAnastasisPage() {
  const pageJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'AboutPage', '@id': absoluteUrl('/what-is-anastasis#webpage'), name: 'What is Anastasis?',
        url: absoluteUrl('/what-is-anastasis'), description,
        about: { '@id': absoluteUrl('/#application') }, isPartOf: { '@id': absoluteUrl('/#website') },
        mainEntity: { '@id': absoluteUrl('/what-is-anastasis#founder') } },
      { '@type': 'Person', '@id': absoluteUrl('/what-is-anastasis#founder'), name: 'Rhea Nyx Anastasia',
        affiliation: { '@id': absoluteUrl('/#organization') },
        hasCredential: [
          { '@type': 'EducationalOccupationalCredential', credentialCategory: 'Certified Personal Trainer' },
          { '@type': 'EducationalOccupationalCredential', credentialCategory: 'Certified Nutrition Coach' },
        ] },
    ],
  }

  return <>
    <TrackEvent event="what_is_anastasis_page_viewed" properties={{ page: 'what-is-anastasis' }} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd) }} />
    <main className={styles.page}>
      <section className={[styles.section, styles.hero].join(' ')} aria-labelledby="what-is-title">
        <div className={styles.inner}>
          <h1 className={styles.eyebrow} id="what-is-title">What is Anastasis?</h1>
          <h2 className={styles.heroTitle}>A more considered way to care for yourself.</h2>
          <div className={styles.prose}>
            <p>You can remember everyone’s appointments, keep work moving, and know what the house needs before anyone asks.</p>
            <p>Yet finding a moment for your own health can mean making another list of decisions.</p>
            <p className={styles.questions}>Which workout should I do? Am I eating enough? Should I push through today, or rest?</p>
            <p>{description}</p>
            <p>So more of the time you make for yourself can actually be spent taking care of yourself.</p>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="feel-like-yourself">
        <div className={[styles.inner, styles.split].join(' ')}>
          <h2 id="feel-like-yourself">You want to feel like yourself again.</h2>
          <div className={styles.prose}>
            <p>Strong when you lift. Comfortable in your clothes. More energy for the life you’re building—and something left for yourself at the end of it.</p>
            <p>You may already be making an effort. Saving workouts. Trying to eat well. Getting back into a routine whenever the week allows.</p>
            <p>But fitting those pieces together takes time and attention, too.</p>
            <p>Anastasis helps ease that planning and guesswork, with a clearer path toward your goals.</p>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="support-for-your-day">
        <div className={[styles.inner, styles.split].join(' ')}>
          <h2 id="support-for-your-day">Support that considers the woman living the day.</h2>
          <div className={styles.prose}>
            <p>Your goals matter. So do your training experience, available equipment, and the time you have.</p>
            <p>Your check-ins add context about how you’re feeling, helping inform the guidance you receive.</p>
            <p>Because a plan should be useful on an ordinary Tuesday, with everything else you have going on.</p>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="what-that-looks-like">
        <div className={styles.inner}>
          <h2 id="what-that-looks-like">What that looks like for you.</h2>
          <div className={styles.supportGrid}>
            {practicalSupport.map(item => <article className={styles.panel} key={item.title}>
              <h3>{item.title}</h3><p>{item.body}</p>
            </article>)}
          </div>
          <p className={styles.note}>The depth of guidance and tools available depends on your chosen program.</p>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="you-deserve-support">
        <div className={styles.inner}>
          <div className={styles.split}>
            <h2 id="you-deserve-support">You deserve support, too.</h2>
            <div className={styles.prose}>
              <p>Created by Rhea Nyx Anastasia, Certified Personal Trainer and Certified Nutrition Coach, Anastasis brings together the pieces women are so often left to manage on their own.</p>
              <p>A place to begin. Guidance to return to. Room to keep going as life changes.</p>
              <p>You carry enough. Your health shouldn’t be one more thing you have to figure out.</p>
            </div>
          </div>
          <div className={[styles.panel, styles.closing].join(' ')}>
            <p>Find your starting point with five brief questions.</p>
            <div className={styles.actions}><Button href="/audit">Find My Starting Point</Button></div>
          </div>
        </div>
      </section>
    </main>
  </>
}
