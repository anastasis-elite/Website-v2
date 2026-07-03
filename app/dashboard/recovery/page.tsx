import { getDashboardContext } from '@/lib/dashboard/getDashboardContext'
import RecoveryLogger from '@/components/RecoveryLogger'
import { getProgramLogicForClient } from '@/lib/dashboard/logic/getProgramLogicForClient'
import { AOSCard } from '@/components/aos-ui/AOSCard'
import BreathingReset from '@/components/recovery/BreathingReset'

export default async function RecoveryPage() {
  const { client, supabase, user } = await getDashboardContext()
  const logic = await getProgramLogicForClient({supabase,user,client})

  return (
    <main className="aos-flow-page">
      <div className="aos-flow-shell">
        <header className="aos-flow-hero"><p className="aos-eyebrow">Recovery</p><h1>Let today&apos;s signals choose the support.</h1><p>Daily Check-In records how you feel. Recovery turns those signals into the next useful action.</p></header>
        <section className="aos-recovery-hero"><div><p className="aos-eyebrow">Today&apos;s recommendation</p><h2>{logic.recoveryStatus.status.replaceAll('_',' ')}</h2><p>{logic.recoveryStatus.reasoning}</p></div><BreathingReset clientId={client.client_id}/></section>
        <div className="aos-recovery-grid"><AOSCard><p className="aos-eyebrow">Movement + mobility</p><h2>{logic.workoutDecision.intensityTarget}</h2><p>{logic.symptoms.recoveryRecommendation}</p></AOSCard><AOSCard><p className="aos-eyebrow">Nervous system</p><h2>{logic.capacityStatus.status.replaceAll('_',' ')}</h2><p>{logic.capacityStatus.drivers.length?`Today reflects ${logic.capacityStatus.drivers.join(', ')}.`:'Your current signals support the planned rhythm.'}</p></AOSCard><AOSCard><p className="aos-eyebrow">Sleep support</p><h2>{logic.sleep.logged?`${logic.sleep.hours??'—'} hours · ${logic.sleep.quality??'—'}/10`:'Sleep needs input'}</h2><p>{logic.sleep.logged?'Use the logged sleep signal when choosing intensity.':'Log sleep so capacity and workout guidance can adjust.'}</p></AOSCard><AOSCard><p className="aos-eyebrow">Fuel + hydration</p><h2>{logic.fuelReadiness.status.replaceAll('_',' ')}</h2><p>{logic.hydration.recoverySupportNote} {logic.fuelReadiness.postWorkoutPriority}</p></AOSCard></div>
        <RecoveryLogger clientId={client.client_id}/>
      </div>
    </main>
  )
}
