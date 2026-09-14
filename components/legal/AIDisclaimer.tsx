import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'

export default function AIDisclaimer({ compact = false }: { compact?: boolean }) {
  return <aside style={compact ? compactStyle : styles.cartBoxStyle}><p style={styles.eyebrowStyle}>AI Transparency</p><p style={{ ...styles.bodyStyle, margin: 0 }}>Anastasis&apos;s core fitness, nutrition, recovery, and readiness decisions are governed by structured Anastasis formulation logic. AI-assisted features, where used, may support explanation, summaries, interaction, or delivery, but they do not independently diagnose conditions or replace the core formulation engine. Outputs may be incomplete or imperfect. Use judgment and consult qualified professionals when appropriate. Medical or emergency concerns require appropriate medical care.</p><Link href="/ai-disclaimer" style={styles.quietLinkStyle}>Read the AI Disclaimer</Link></aside>
}

const compactStyle = { padding: '16px 18px', borderRadius: '20px', background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' } as const
