import Link from 'next/link'
import styles from './TodayAffirmation.module.css'

/** Presentation only: callers retain the existing activity and secured-day decisions. */
export default function TodayAffirmation({ recorded, completed }: { recorded: boolean; completed: boolean }) {
  return <div className={styles.card} data-testid="today-affirmation" data-completed={completed ? 'true' : undefined}>
    <img className={styles.art} src="/images/affirmations/copper-rest.webp"
      srcSet="/images/affirmations/copper-rest-900.webp 900w, /images/affirmations/copper-rest.webp 1774w"
      sizes="(max-width: 640px) calc(100vw - 40px), 960px"
      width={1774} height={887} alt="" aria-hidden="true" loading="lazy" decoding="async" />
    <div className={styles.copy}>
      {recorded ? <p className={styles.body} role="status">Your recorded activities are saved. You can revisit your progress and history anytime.</p>
        : <><h3 className={styles.heading}>Look at you showing up for yourself.</h3>
          <p className={styles.body} role="status">You’re making space for your well-being today, and that matters. Take a breath and enjoy this moment. You’re doing beautifully.</p></>}
      <Link className={styles.action} href="/dashboard/progress">View progress</Link>
    </div>
  </div>
}
