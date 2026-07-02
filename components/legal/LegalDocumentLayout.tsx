import * as styles from '@/app/styles/globalstyles'
import { EFFECTIVE_DATE, LEGAL_DRAFT_NOTICE } from '@/lib/legal/config'

export default function LegalDocumentLayout({ title, version, children }: { title: string; version: string; children: React.ReactNode }) {
  return <main style={styles.pageStyle}><div style={{ ...styles.containerStyle, maxWidth: '900px' }}><p style={styles.eyebrowStyle}>Legal · {version}</p><h1 style={styles.heroTitleStyle}>{title}</h1><p style={draftStyle}>{LEGAL_DRAFT_NOTICE}</p><p style={styles.bodyStyle}><strong>Effective date:</strong> {EFFECTIVE_DATE}</p>{children}</div></main>
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section style={{ ...styles.sectionStyle, marginBottom: '34px' }}><h2 style={styles.h2Style}>{title}</h2><div style={styles.bodyStyle}>{children}</div></section>
}

const draftStyle = { ...styles.bodyStyle, padding: '14px 18px', borderRadius: '18px', background: 'rgba(181,110,67,.12)', border: '1px solid rgba(181,110,67,.3)' } as const
