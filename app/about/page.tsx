import type { Metadata } from 'next'
import TrackEvent from '@/components/TrackEvent'
import TrackedButton from '@/components/TrackedButton'
import { BRAND_NAME } from '@/lib/seo'
import styles from '../styles/publicEditorial.module.css'

const description = 'The story behind Anastasis. Built from a life that needed it.'

export const metadata: Metadata = {
  title: 'About Anastasis', description,
  alternates: { canonical: '/about' },
  openGraph: { title: 'About Anastasis', description, url: '/about', siteName: BRAND_NAME },
  twitter: { card: 'summary', title: 'About Anastasis', description },
}

export default function AboutPage() {
  return <>
    <TrackEvent event="about_page_viewed" properties={{ page: 'about' }} />
    <main className={styles.page}>
      <section className={[styles.section, styles.hero].join(' ')} aria-labelledby="about-title">
        <div className={styles.inner}>
          <h1 className={styles.heroTitle} id="about-title">Built from a life that needed it.</h1>
          <p className={[styles.eyebrow, styles.heroSubtitle].join(' ')}>The story behind Anastasis.</p>
          <div className={styles.prose}>
            <p>Anastasis began with questions from my own life.</p>
            <p>I’m a mother of four, a personal trainer, and a nutrition coach. I know what it feels like to care deeply about your health while having a day already full of people and responsibilities that need your attention.</p>
            <p>I also know the effort that happens before a workout ever begins.</p>
            <p>Finding the time. Choosing what to do. Working out what to eat. Trying to understand why something felt manageable last week and feels exhausting today.</p>
            <p>You can want to take care of yourself and still struggle to find room for all the decisions that come with it.</p>
            <p>That became the starting point for Anastasis.</p>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="wanted-to-understand">
        <div className={[styles.inner, styles.split].join(' ')}>
          <h2 id="wanted-to-understand">First, I wanted to understand.</h2>
          <div className={styles.prose}>
            <p>My own training gave me reasons to look more closely.</p>
            <p>How I moved. Where I felt discomfort. What changed as I became stronger. How sleep, stress, and recovery affected what I could bring to a workout.</p>
            <p>Becoming a certified personal trainer and nutrition coach gave me a foundation to investigate those questions more thoughtfully. Working with women made the picture bigger.</p>
            <p>A program could look carefully planned and still be difficult to use in someone’s actual life.</p>
            <p>The exercises were only part of the experience. There was also the interrupted night, the workday that ran over, the family responsibilities, and the energy it took to make another decision.</p>
            <p>I wanted those things to have a place in the plan.</p>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="beyond-the-workout">
        <div className={[styles.inner, styles.split].join(' ')}>
          <h2 id="beyond-the-workout">The idea grew beyond the workout.</h2>
          <div className={styles.prose}>
            <p>The more I considered what useful support would look like, the more connected it became.</p>
            <p>Training belonged alongside nutrition. Recovery needed a place in the day. Progress needed to be easier to see than trying to remember how things felt a month ago.</p>
            <p>And all of it needed to make sense to the woman opening it.</p>
            <p>That became Anastasis: a place to bring those pieces together, with guidance that helps make caring for yourself more manageable.</p>
            <p>The purpose has stayed the same as the idea has grown:</p>
            <p>You carry enough. Your health shouldn’t be one more thing you have to figure out.</p>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="built-in-the-details">
        <div className={[styles.inner, styles.split].join(' ')}>
          <h2 id="built-in-the-details">Behind the scenes, it’s built in the details.</h2>
          <div className={styles.prose}>
            <p>Building Anastasis happens alongside the life that inspired it.</p>
            <p>Between motherhood, coaching, my own training, and the everyday work of keeping a household moving, I’m shaping the experience one decision at a time.</p>
            <p>Some days, that means working through how a training plan should be presented. Other days, it means testing a photo upload, reconsidering a check-in, or opening the same screen on my phone, tablet, and computer to see how it actually feels to use.</p>
            <p>There are small questions behind those decisions.</p>
            <p>Can she see where to begin?</p>
            <p>Can she record a little progress when she hasn’t finished everything?</p>
            <p>If her afternoon changes, can she find her way back without feeling lost?</p>
            <p>Those details matter because they’re the moments when a thoughtful idea becomes useful support.</p>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="refined-through-use">
        <div className={[styles.inner, styles.split].join(' ')}>
          <h2 id="refined-through-use">Built with ambition. Refined through real use.</h2>
          <div className={styles.prose}>
            <p>Anastasis is still growing.</p>
            <p>I’m testing, listening, and refining how the pieces work together. Some parts of the wider vision are still ahead, and I want to be clear about what is available as each part takes shape.</p>
            <p>The standard I keep returning to is simple: does this make caring for herself easier to understand and easier to fit into her life?</p>
            <p>That question guides what I build next.</p>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="a-life-in-motion">
        <div className={styles.inner}>
          <div className={[styles.panel, styles.closing].join(' ')}>
            <h2 id="a-life-in-motion">A place for the woman with a life already in motion.</h2>
            <div className={styles.prose}>
              <p>I’m building Anastasis for the woman who has goals of her own alongside everything she does for others.</p>
              <p>The woman who wants to feel stronger, feel more at home in her body, and make progress without spending every spare moment researching how.</p>
              <p>I want her to open Anastasis and feel that her life was considered.</p>
              <p>Because it was.</p>
            </div>
            <footer className={styles.signature}>
              <p>Rhea Nyx Anastasia</p>
              <p>Founder · Certified Personal Trainer · Certified Nutrition Coach</p>
            </footer>
            <div className={styles.actions}>
              <TrackedButton href="/audit" event="audit_cta_clicked_about" properties={{ location: 'final_cta', page: 'about' }}>Find Your Starting Point</TrackedButton>
            </div>
          </div>
        </div>
      </section>
    </main>
  </>
}
