import Link from 'next/link'

const links = [
  ['Terms', '/terms'], ['Privacy', '/privacy'], ['Health Disclaimer', '/health-disclaimer'],
  ['AI Disclaimer', '/ai-disclaimer'], ['Billing / Refunds', '/refund-policy'], ['Research Consent', '/research-consent'],
]

export default function LegalFooter() {
  return <footer className="legal-footer"><nav aria-label="Legal links">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav><p>© {new Date().getFullYear()} Anastasis Elite</p></footer>
}
