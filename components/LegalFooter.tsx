import Link from 'next/link'

const links = [
  ['What is Anastasis?', '/what-is-anastasis'], ['Programs', '/program'], ['About Anastasis', '/about'],
  ['Terms', '/terms'], ['Privacy', '/privacy'], ['Health Disclaimer', '/health-disclaimer'],
  ['AI Disclaimer', '/ai-disclaimer'], ['Billing / Refunds', '/refund-policy'], ['Research Consent', '/research-consent'],
]

export default function LegalFooter() {
  return <footer className="legal-footer"><p className="legal-footer-brand">Anastasis — Health & Performance Concierge Platform for Women</p><nav aria-label="Footer links">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</nav><p>© {new Date().getFullYear()} Anastasis Elite</p></footer>
}
