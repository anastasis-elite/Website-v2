import * as styles from '@/app/styles/globalstyles'
import { legalRiskRegister } from '@/lib/aos/legal/riskRegister'
import { EFFECTIVE_DATE } from '@/lib/legal/config'

export default function ComplianceRoadmapPage() {
  return <main style={styles.pageStyle}><div style={styles.containerStyle}>
    <p style={styles.eyebrowStyle}>Compliance Roadmap</p>
    <h1 style={styles.heroTitleStyle}>Launch controls requiring review.</h1>
    <p style={styles.bodyStyle}>Roadmap date: {EFFECTIVE_DATE}</p>
    <div style={styles.cardGridStyle}>{legalRiskRegister.map((risk) => <section key={risk.id} style={styles.cardStyle}><p style={styles.eyebrowStyle}>{risk.status}</p><h2 style={styles.cardTitleStyle}>{risk.area}</h2><p style={styles.cardTextStyle}>{risk.nextAction}</p></section>)}</div>
  </div></main>
}
