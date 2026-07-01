import * as styles from '@/app/styles/globalstyles'
import { legalRiskRegister } from '@/lib/aos/legal/riskRegister'

export default function AOSLegalPage() {
  return (
    <>
      <p style={styles.eyebrowStyle}>Legal Risk Engine</p>
      <h1 style={styles.heroTitleStyle}>Issues requiring evidence, ownership, and review.</h1>
      <p style={styles.heroTextStyle}>This register supports issue spotting and document control. It is not legal advice, does not determine every liability, and does not replace qualified counsel.</p>
      <div style={{ display: 'grid', gap: '18px' }}>
        {legalRiskRegister.map((item) => (
          <section key={item.id} style={styles.cartBoxStyle}>
            <p style={styles.eyebrowStyle}>{item.status} · {item.area}</p>
            <h2 style={styles.sectionTitleStyle}>{item.risk}</h2>
            <p style={styles.bodyStyle}><strong>Evidence:</strong> {item.evidence}</p>
            <p style={styles.bodyStyle}><strong>Next action:</strong> {item.nextAction}</p>
            <p style={styles.bodyStyle}><strong>Review:</strong> {item.reviewCadence}</p>
          </section>
        ))}
      </div>
    </>
  )
}
