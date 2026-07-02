import Link from 'next/link'
import LegalDocumentLayout, { LegalSection } from '@/components/legal/LegalDocumentLayout'
import AIDisclaimer from '@/components/legal/AIDisclaimer'
import { LEGAL_CONTACT_EMAIL, TERMS_VERSION } from '@/lib/legal/config'

export default function TermsPage() {
  return <LegalDocumentLayout title="Terms of Service" version={TERMS_VERSION}>
    <LegalSection title="Scope of service"><p>Anastasis provides fitness programming, nutrition education, recovery guidance, habit and progress tracking, and adaptive wellness support. Services are educational and coaching-oriented and depend on the accuracy and completeness of information you provide.</p></LegalSection>
    <LegalSection title="Not medical or emergency care"><p>Anastasis does not diagnose, treat, cure, or prevent disease and is not a substitute for a physician, registered dietitian, mental-health professional, emergency service, or other licensed provider. Do not use the service for an emergency. Call 911 or your local emergency number when immediate help may be required.</p></LegalSection>
    <LegalSection title="Responsibility and assumption of risk"><p>Physical activity and dietary changes involve risk. You are responsible for obtaining appropriate clearance, using accurate inputs, choosing safe environments and equipment, following technique instructions, and stopping when participation is unsafe.</p></LegalSection>
    <LegalSection title="Contraindications and stopping exercise"><p>Stop exercise and seek appropriate care for chest pain, fainting, severe shortness of breath, acute injury, severe dizziness, severe bleeding, pregnancy complications, or other alarming symptoms. Do not continue solely because the platform generated a task.</p></LegalSection>
    <LegalSection title="AI-assisted recommendations"><AIDisclaimer compact /></LegalSection>
    <LegalSection title="Billing, renewal, cancellation, and refunds"><p>Subscriptions may renew automatically until canceled. Failed payments may suspend access. Cancellation prevents future renewal but does not automatically refund prior charges. Refund eligibility, timing, and exceptions are described in the <Link href="/refund-policy">Billing and Refund Policy</Link> and remain subject to applicable law and payment-network requirements.</p></LegalSection>
    <LegalSection title="Data collection and research"><p>Our <Link href="/privacy">Privacy Policy</Link> explains collection, processing, retention, security, and deletion. Optional anonymized research use is governed separately by <Link href="/research-consent">Research Consent</Link> and is not required to purchase or use the program.</p></LegalSection>
    <LegalSection title="Changes and revision history"><p>Current version: {TERMS_VERSION}. Initial launch draft effective July 1, 2026. Material changes require a new version and renewed acceptance before dashboard access.</p></LegalSection>
    <LegalSection title="Contact"><p><a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a></p></LegalSection>
  </LegalDocumentLayout>
}
