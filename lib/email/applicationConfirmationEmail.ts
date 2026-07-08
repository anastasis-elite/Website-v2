import { TERMS_VERSION } from '@/lib/legal/config'

export function buildApplicationConfirmationEmail({
  fullName,
  termsVersion = TERMS_VERSION,
}: {
  fullName?: string
  termsVersion?: string
}) {
  const name = fullName || 'there'

  return {
    subject: 'Your Anastasis Elite Application Was Received',
    text: `
Hi ${name},

Thank you for applying for Anastasis Elite’s health and training system.

This email confirms that your application was received. It also provides a written copy of the important terms, disclaimers, and acknowledgments connected to your application.

By submitting your application, you acknowledged that:

1. Anastasis Elite is not a medical provider and does not diagnose, treat, cure, or prevent disease.
2. Coaching, training, nutrition guidance, cycle-aware recommendations, supplement education, and wellness guidance are educational and supportive in nature.
3. You are responsible for consulting a qualified medical professional before beginning any exercise, nutrition, supplement, or wellness protocol, especially if pregnant, postpartum, injured, medicated, diagnosed with a condition, or under medical care.
4. Exercise, nutrition changes, supplements, sauna, recovery practices, and lifestyle protocols may carry risk.
5. Your results are not guaranteed and depend on many factors including consistency, health status, effort, sleep, stress, nutrition, recovery, and medical history.
6. Anastasis Elite may use your application responses to determine fit, personalize recommendations, and support your experience if accepted.
7. If accepted into a tier involving shipped products, your provided address may be used for fulfillment, onboarding materials, anniversary items, or related member shipments.
8. You are responsible for providing accurate information and updating Anastasis Elite if your health status, medications, pregnancy status, injuries, or address changes.

Terms version: ${termsVersion}

Important Documents:

Terms of Use:
https://anastasiselite.com/terms

Health Conditions & Participation Requirements:
https://anastasiselite.com/conditions

Health Disclaimer:
https://anastasiselite.com/health-disclaimer

AI Disclaimer:
https://anastasiselite.com/ai-disclaimer

Research & Data Consent:
https://anastasiselite.com/consent/research

Please review and retain these documents for your records.

With respect,
Anastasis Elite
    `.trim(),
  }
}
