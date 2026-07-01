import * as styles from '@/app/styles/globalstyles'
import AOSRevenueLive from '@/components/AOSRevenueLive'

export default function AOSRevenuePage() {
  return <><p style={styles.eyebrowStyle}>Revenue Engine</p><h1 style={styles.heroTitleStyle}>Revenue, growth, commissions, and profit.</h1><p style={styles.heroTextStyle}>Stripe is the financial source of truth. Operating costs remain configurable and explicit.</p><AOSRevenueLive /></>
}
