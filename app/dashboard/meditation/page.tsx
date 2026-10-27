import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import MeditationPractice from '@/components/meditation/MeditationPractice'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import '@/components/phone-app/detail-screens.css'

export default async function MeditationPage({searchParams}:{searchParams:Promise<{practice?:string}>}) {
  const query=await searchParams,{client}=await getDashboardContext()
  return <PhoneAppFrame backHref="/dashboard/recovery" backLabel="Recovery" eyebrow="Recovery" title="Meditation & Breathwork" subtitle="A little room to reset."><main className="detail-content"><MeditationPractice key={query.practice||'breath-reset'} clientId={client.client_id} initialPractice={query.practice||'breath-reset'}/></main></PhoneAppFrame>
}
