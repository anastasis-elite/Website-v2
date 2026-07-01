import { redirect } from 'next/navigation'

export default function NutritionistReferralPage() {
  const code = process.env.NUTRITIONIST_REFERRAL_CODE || 'nutritionist'
  redirect(`/program/phoenix?ref=${encodeURIComponent(code)}`)
}
