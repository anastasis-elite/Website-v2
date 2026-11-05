'use client'

import { useId, useRef, useState } from 'react'
import Link from 'next/link'
import CardArtwork from '@/components/CardArtwork'

import RecoveryLogger from '@/components/RecoveryLogger'
import RecoveryActivitySheets from '@/components/recovery/RecoveryActivitySheets'
import ActionArrow from '@/components/ActionArrow'
import cardStyles from './RecoveryCards.module.css'

export function OwnPractice({ clientId }: { clientId: string }) {
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  return <section className="phone-app-own-practice" id="own-practice">
    <span>Your own practice</span>
    <button ref={trigger} type="button" aria-haspopup="dialog" aria-controls={id} onClick={() => dialog.current?.showModal()}>Log your practice</button>
    <dialog ref={dialog} id={id} className="phone-app-practice-dialog" aria-labelledby={`${id}-title`} onClose={() => trigger.current?.focus()}>
      <header><h2 id={`${id}-title`}>Log your practice</h2><button type="button" onClick={() => dialog.current?.close()}>Close</button></header>
      <RecoveryLogger clientId={clientId} />
    </dialog>
  </section>
}

const guidedPractices = [
  { title: 'Meditation', illustration: 'meditation', description: 'Make a quiet moment for yourself with the silent meditation timer. Choose the duration that fits your own practice.', href: '/dashboard/meditation?practice=recovery-meditation', action: 'Open silent timer' },
  { title: 'Yoga nidra', illustration: 'yoga-nidra', description: 'Yoga nidra is a guided resting practice. A guided recording is not available here; you can record a practice you complete elsewhere using your own practice logger.', unavailable: 'Guided recording unavailable' },
  { title: 'Guided mobility', illustration: 'mobility', description: 'Choose movement that fits your capacity and your existing guidance. Guided mobility sessions are not available here. You can log your own completed practice.', unavailable: 'Guided sessions unavailable' },
  { title: 'Yogic practices', illustration: 'yogic-practices', description: 'A gentle practice at your own pace. Guided yogic recordings are not available here. Record your own completed practice if you choose one.', unavailable: 'Guided sessions unavailable' },
  { title: 'Breathwork', illustration: 'breathwork', description: 'Come back to center with the existing breathing timer. Use a comfortable practice and stop if you feel unwell.', href: '/dashboard/meditation?practice=breath-reset', action: 'Open breathing timer' },
] as const

export function GuidedRecoveryCards() {
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const [selected, setSelected] = useState(0)
  const practice = guidedPractices[selected]
  return <>
    {guidedPractices.map((item, index) => <button className={cardStyles.card} key={item.title} type="button" aria-label={`View ${item.title} details`} aria-haspopup="dialog" aria-controls={id} onClick={event => { trigger.current = event.currentTarget; setSelected(index); dialog.current?.showModal() }}>
      <CardArtwork kind={item.illustration} sizes="(max-width: 320px) 100vw, (max-width: 640px) 50vw, 33vw" />
      <span className={cardStyles.copy}><span className={cardStyles.title}>{item.title}</span><ActionArrow className={cardStyles.arrow} /></span>
    </button>)}
    <dialog ref={dialog} id={id} className={`phone-app-practice-dialog ${cardStyles.dialog}`} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onClose={() => trigger.current?.focus()}>
      <header><h2 id={`${id}-title`}>{practice.title}</h2><button type="button" onClick={() => dialog.current?.close()}>Close</button></header>
      <p id={`${id}-description`}>{practice.description}</p>
      {'href' in practice ? <Link href={practice.href}>{practice.action}<ActionArrow className={cardStyles.arrow} /></Link> : <>
        <p role="status">{practice.unavailable}</p>
        <Link href="#own-practice" onClick={() => dialog.current?.close()}>Log your own practice</Link>
      </>}
    </dialog>
  </>
}

export default function RecoveryDashboardClient({ clientId }: { clientId: string }) {
  return (
    <main className="aos-nutrition-page recovery-dashboard-page">
      <div className="aos-nutrition-shell recovery-dashboard-shell">
        <OwnPractice clientId={clientId} />
        <h2>Let us guide you.</h2>
        <div className={cardStyles.grid}>
          <GuidedRecoveryCards />
        </div>
        <h2>Simple ways to unwind.</h2><div className={cardStyles.grid}>
          <RecoveryActivitySheets clientId={clientId} />
        </div>
      </div>
    </main>
  )
}
