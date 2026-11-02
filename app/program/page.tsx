import type { Metadata } from 'next'
import Button from '@/components/Button'
import TrackEvent from '@/components/TrackEvent'
import { BRAND_NAME } from '@/lib/seo'
import styles from '../styles/publicEditorial.module.css'

const description = 'Choose from three levels of support, each bringing your training, nutrition, recovery, and progress together—with different amounts of detail and daily direction.'

export const metadata: Metadata = {
  title: 'Anastasis Programs', description,
  alternates: { canonical: '/program' },
  openGraph: { title: 'Anastasis Programs', description, url: '/program', siteName: BRAND_NAME },
  twitter: { card: 'summary', title: 'Anastasis Programs', description },
}

const programs = [
  { name: 'EMBER', headline: 'A clear plan to come back to.',
    paragraphs: [
      'You’ve saved the workouts. You’ve started on Mondays. You know how good it feels when you find your rhythm.',
      'Then the week gets full, and deciding where to begin again becomes its own task.',
      'Ember gives you a foundation you can return to: your training plan, nutrition and water targets, and basic recovery guidance, together in one place.',
      'When you make time for yourself, you have somewhere to start.',
    ],
    includesLabel: 'Your support includes:',
    includes: [
      'Training shaped by your starting assessments.',
      'Nutrition targets and a simple place to enter daily totals.',
      'Water tracking.',
      'Basic recovery guidance.',
      'Progress records, foundational assessments, and cycle context.',
    ],
    forYou: 'For you if: You want a clear structure and feel comfortable managing the day-to-day details yourself.',
    href: '/program/ember', action: 'Explore Ember', id: 'ember' },
  { name: 'IGNITE', headline: 'More understanding behind your effort.',
    paragraphs: [
      'You’re making time for your health. But some days, you finish a workout or look back over what you’ve eaten and still wonder what needs your attention.',
      'You’d like more than a record of what you did. You want a clearer picture.',
      'Ignite builds on the foundation with food logging, more nutrition detail, and additional recovery recommendations. It brings those details alongside your training so they’re easier to consider together.',
      'A place to look more closely, without keeping everything in your head.',
    ],
    includesLabel: 'Your support includes everything in Ember, plus:',
    includes: [
      'Food logging, including barcode scanning.',
      'Nutrient details from the foods you record.',
      'Additional recovery recommendations.',
      'Progress photo uploads.',
      'Posture tools with landmarks you review and confirm.',
    ],
    forYou: 'For you if: You like understanding the details and want more information to help guide your choices.',
    href: '/program/ignite', action: 'Explore Ignite', id: 'ignite' },
  { name: 'PHOENIX', headline: 'Less figuring out. A clearer next step.',
    paragraphs: [
      'By the time you get a moment to yourself, you’ve already made decisions for work, the household, and everyone who needed something.',
      'Even a good plan can feel like more to sort through.',
      'Phoenix offers our most directed experience, bringing meal recommendations and suggested nutrition and recovery actions into your daily view.',
      'So when you open Anastasis, there’s guidance to help you decide what deserves your attention next.',
    ],
    includesLabel: 'Your support includes everything in Ignite, plus:',
    includes: [
      'Meal recommendations.',
      'More direct guidance on your next nutrition and recovery steps.',
      'Suggestions informed by the information you share.',
    ],
    forYou: 'For you if: You want more help deciding what to do next and less time spent working through the details.',
    href: '/program/phoenix', action: 'Explore Phoenix', id: 'phoenix' },
]

export default function ProgramPage() {
  return <>
    <TrackEvent event="program_page_viewed" properties={{ page: 'programs' }} />
    <main className={styles.page}>
      <section className={[styles.section, styles.hero].join(' ')} aria-labelledby="programs-title">
        <div className={styles.inner}>
          <h1 className={styles.heroTitle} id="programs-title">Find the support that feels right for you.</h1>
          <div className={styles.prose}>
            <p>Some mornings, you have time for yourself before the house wakes up. Others, you’re answering messages while looking for someone’s shoes.</p>
            <p>You still want to feel strong. Eat well. Feel comfortable in your body. Have energy for something beyond getting through the day.</p>
            <p>Anastasis gives those goals a place in the life you’re already living.</p>
            <p>{description}</p>
          </div>
          <div className={styles.actions}>
            <Button href="#programs">Explore the Programs</Button>
            <Button href="/audit" variant="secondary">Help Me Choose</Button>
          </div>
        </div>
      </section>

      <section className={styles.section} id="programs" aria-labelledby="program-support">
        <div className={styles.inner}>
          <h2 id="program-support">What would make taking care of yourself feel easier?</h2>
          <div className={styles.programs}>
            {programs.map(program => <article key={program.id} className={[styles.panel, styles.programPanel].join(' ')} aria-labelledby={program.id + '-title'}>
              <div>
                <p className={styles.eyebrow}>{program.name}</p>
                <h3 className={styles.programTitle} id={program.id + '-title'}>{program.headline}</h3>
                <div className={styles.prose}>{program.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div>
              </div>
              <div className={styles.programDetails}>
                <p className={styles.includesLabel}>{program.includesLabel}</p>
                <ul>{program.includes.map(item => <li key={item}>{item}</li>)}</ul>
                <p className={styles.forYou}>{program.forYou}</p>
                <div className={styles.actions}><Button href={program.href}>{program.action}</Button></div>
              </div>
            </article>)}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="begin-today">
        <div className={styles.inner}>
          <div className={[styles.panel, styles.closing].join(' ')}>
            <h2 id="begin-today">Begin with the support you need today.</h2>
            <div className={styles.prose}>
              <p>You don’t have to build a perfect routine before you belong here.</p>
              <p>You can arrive with a full calendar, an interrupted week, and goals that still matter to you.</p>
              <p>Tell us a little about your time, energy, and the support you’re looking for. Five brief questions will suggest a program for you to explore.</p>
            </div>
            <div className={styles.actions}><Button href="/audit">Find My Starting Point</Button></div>
            <p className={styles.note}>About 1–2 minutes. Space to consider what feels right.</p>
          </div>
        </div>
      </section>
    </main>
  </>
}
