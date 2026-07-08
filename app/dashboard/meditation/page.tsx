import Link from 'next/link'
import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import MeditationPractice from '@/components/meditation/MeditationPractice'

export default async function MeditationPage({searchParams}:{searchParams:Promise<{practice?:string}>}){const query=await searchParams;const {client}=await getDashboardContext();return <main className="meditation-page"><div className="meditation-shell"><Link href={`/dashboard/program/${client.program||'ignite'}`} className="meditation-back">← Dashboard</Link><MeditationPractice clientId={client.client_id} initialPractice={query.practice||'breath-reset'}/></div></main>}
