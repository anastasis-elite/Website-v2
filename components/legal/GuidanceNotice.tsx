import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'

export default function GuidanceNotice({ compact = false }: { compact?: boolean }) {
  return <aside style={compact ? compactStyle : styles.cartBoxStyle}><p style={styles.eyebrowStyle}>Guidance and measurements</p><p style={{ ...styles.bodyStyle, margin: 0 }}>Anastasis’s fitness, nutrition, recovery, and readiness guidance uses structured coaching formulations. Guidance and measurements depend on the information available and may be incomplete or imperfect. Review your inputs, use judgment, and consult qualified professionals when appropriate. These tools do not diagnose conditions or replace medical or emergency care.</p><Link href="/health-disclaimer" style={styles.quietLinkStyle}>Read the Health Disclaimer</Link></aside>
}

const compactStyle = { padding: '16px 18px', borderRadius: '20px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' } as const
