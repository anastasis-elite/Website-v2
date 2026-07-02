export type LegalRisk = {
  id: string
  area: string
  status: 'urgent' | 'review' | 'tracked'
  evidence: string
  risk: string
  nextAction: string
  reviewCadence: string
}

export const legalRiskRegister: LegalRisk[] = [
  {
    id: 'privacy-policy', area: 'Health-data privacy', status: 'urgent',
    evidence: 'The product collects cycle, symptom, nutrition, workout, photo, and assessment data; no dedicated privacy-policy route is currently present.',
    risk: 'Clients may not receive a complete explanation of collection, use, retention, vendors, deletion rights, and incident handling.',
    nextAction: 'Have qualified counsel draft a health-data privacy policy and determine FTC Health Breach Notification Rule applicability.', reviewCadence: 'Quarterly and after every new data integration',
  },
  {
    id: 'breach-plan', area: 'Incident response', status: 'urgent',
    evidence: 'No documented breach-response and notification workflow is represented in the site.',
    risk: 'A health-data incident may trigger time-sensitive consumer and regulatory notification duties.',
    nextAction: 'Create an incident-response plan, vendor contact tree, evidence log, and notification decision process.', reviewCadence: 'Semiannual exercise',
  },
  {
    id: 'terms-version', area: 'Terms and acceptance evidence', status: 'review',
    evidence: 'Applications and dashboard acceptance now store centralized version identifiers; qualified review must validate the published language and acceptance evidence.',
    risk: 'It may be difficult to prove which exact language a client accepted.',
    nextAction: 'Add effective dates, immutable versions, change history, and acceptance timestamp/IP/user evidence where lawful.', reviewCadence: 'Every revision',
  },
  {
    id: 'refund-cancellation', area: 'Billing and cancellation', status: 'review',
    evidence: 'Terms state all payments are final; the site offers recurring subscriptions.',
    risk: 'Refund and cancellation language may conflict with card-network rules or applicable consumer-protection law.',
    nextAction: 'Have counsel review refund, renewal, cancellation, and failed-payment language for every selling jurisdiction.', reviewCadence: 'Quarterly',
  },
  {
    id: 'physical-activity', area: 'Training and health scope', status: 'review',
    evidence: 'Terms disclaim medical care, while dashboards adapt training using health, symptom, and cycle inputs.',
    risk: 'Product behavior could be interpreted as individualized health advice beyond stated scope.',
    nextAction: 'Review informed-consent, assumption-of-risk, contraindication, escalation, and emergency language with qualified counsel.', reviewCadence: 'Before material program-logic changes',
  },
  {
    id: 'nutritionist-agreement', area: 'Nutritionist compensation and referrals', status: 'urgent',
    evidence: 'Planned compensation is 5% of Phoenix receipts or 12.5% for attributed referrals.',
    risk: 'Ambiguity may arise around refunds, renewals, taxes, attribution windows, termination, payment timing, and professional responsibility.',
    nextAction: 'Execute a written contractor/referral agreement defining commission base, attribution, reversals, records, scope, licensing, confidentiality, and termination.', reviewCadence: 'Annually and on rate changes',
  },
  {
    id: 'research-consent', area: 'Research consent', status: 'review',
    evidence: 'A research-consent page exists and says aggregated or anonymized prior analysis may continue after revocation.',
    risk: 'Research characterization, de-identification method, withdrawal handling, and any ethics-review requirements need jurisdiction-specific review.',
    nextAction: 'Obtain counsel review before using client data for generalizable research, publication, or external sharing.', reviewCadence: 'Before each research use',
  },
]
