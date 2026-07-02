import * as styles from '@/app/styles/globalstyles'
import type { SafetyFlag } from '@/lib/safety/evaluateSafetyEscalation'

export default function SafetyEscalationNotice({ flags }: { flags: SafetyFlag[] }) {
  const emergency = flags.some((flag) => flag.urgency === 'emergency')
  return <main style={styles.pageStyle}><div style={{ ...styles.containerStyle, maxWidth: '780px' }}>
    <p style={styles.eyebrowStyle}>Safety First</p>
    <h1 style={styles.heroTitleStyle}>The program is paused for this signal.</h1>
    <p style={styles.heroTextStyle}>Anastasis will not generate a workout or nutrition recommendation from these inputs.</p>
    <section style={styles.cartBoxStyle}>
      <h2 style={styles.sectionTitleStyle}>{emergency ? 'Seek immediate appropriate help.' : 'Seek prompt professional guidance.'}</h2>
      <p style={styles.bodyStyle}>{emergency ? 'If this may be an emergency, call 911 or your local emergency number now. In the United States, call or text 988 for suicide or crisis support.' : 'Contact an appropriate qualified healthcare professional before resuming recommendations or training.'}</p>
      <p style={styles.bodyStyle}>Flagged signal{flags.length === 1 ? '' : 's'}: {flags.map((flag) => flag.label).join(', ')}.</p>
    </section>
  </div></main>
}
