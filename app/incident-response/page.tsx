import LegalDocumentLayout, { LegalSection } from '@/components/legal/LegalDocumentLayout'
import { PRIVACY_VERSION } from '@/lib/legal/config'

export default function IncidentResponsePage() {
  return <LegalDocumentLayout title="Incident Response Framework" version={PRIVACY_VERSION}>
    <LegalSection title="Detection"><p>Record the reporter, discovery time, affected system, suspected data, and immediate indicators. Preserve logs and avoid altering evidence unnecessarily.</p></LegalSection>
    <LegalSection title="Containment"><p>Restrict compromised access, rotate affected credentials, isolate vulnerable services, preserve availability where safe, and document every containment action.</p></LegalSection>
    <LegalSection title="Investigation"><p>Determine scope, timeline, affected people and data, access method, vendors involved, continuing exposure, and whether information was acquired or disclosed.</p></LegalSection>
    <LegalSection title="Vendor contact tree placeholder"><p>Supabase/database, Vercel/hosting, Stripe/payments, email, analytics, AI, and storage providers require named owners, escalation contacts, and contractual notification periods before launch.</p></LegalSection>
    <LegalSection title="Evidence log placeholder"><p>Maintain timestamps, screenshots, request IDs, audit logs, impacted records, decisions, communications, credential rotations, and remediation evidence in a restricted incident file.</p></LegalSection>
    <LegalSection title="Notification decision"><p>Qualified legal counsel must determine applicable consumer, regulator, vendor, insurer, law-enforcement, and media notices; required content; and deadlines, including potential FTC Health Breach Notification Rule obligations.</p></LegalSection>
    <LegalSection title="Post-incident review"><p>Document root cause, control failures, corrective actions, owners, due dates, validation, policy changes, and whether affected agreements or disclosures must be revised.</p></LegalSection>
  </LegalDocumentLayout>
}
