'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { usePwaInstall } from './PwaInstallProvider'
import styles from './TodayInstallButton.module.css'

export default function TodayInstallButton() {
  const { ready, installed, device, canPrompt, busy, result, install } = usePwaInstall()
  const [manual, setManual] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const instructions = useRef<HTMLDivElement>(null)
  const id = useId()
  const nativeAvailable = canPrompt && device !== 'ios'
  const showSteps = manual || (!nativeAvailable && result !== 'idle')
  const close = () => dialog.current?.close()

  useEffect(() => {
    if (installed) dialog.current?.close()
  }, [installed])

  useEffect(() => {
    if (manual) instructions.current?.focus()
  }, [manual])

  useEffect(() => {
    const modal = dialog.current
    return () => { if (modal?.open) modal.close() }
  }, [])

  return <>
    {ready && !installed && <button ref={trigger} type="button" className={styles.trigger} aria-haspopup="dialog" aria-controls={id} onClick={() => {
      setManual(false)
      if (!dialog.current?.open) dialog.current?.showModal()
      heading.current?.focus()
    }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false"><path d="M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5" /></svg>
      Add Anastasis to your Home Screen
    </button>}
    <dialog ref={dialog} id={id} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event => { event.preventDefault(); close() }} onClose={() => trigger.current?.focus()}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <h2 ref={heading} id={`${id}-title`} tabIndex={-1}>Anastasis, one tap away</h2>
          <button type="button" className={styles.close} onClick={close} aria-label="Close installation instructions">Close</button>
        </header>
        <div className={styles.content}>
          <p id={`${id}-description`}>Add Anastasis to your Home Screen for an icon that opens it like an app. No app-store download needed.</p>
          {device === 'desktop' && <p>Installing here adds Anastasis to this computer. To add it to your phone, open this website in a browser on that phone and tap “Add Anastasis to your Home Screen” on Today.</p>}
          {device === 'ios' ? <p>Your iPhone or iPad adds the icon through your browser’s Share menu. The steps below will guide you.</p> : nativeAvailable ? <p>The button below opens your browser’s installation confirmation. You choose whether to install.</p> : <p>You can use your browser’s menu to add Anastasis. See the steps below for this device.</p>}
          <p role="status" aria-live="polite" className={styles.status}>
            {busy ? 'Waiting for your browser’s confirmation…' : result === 'accepted' ? 'You confirmed the browser’s prompt. When installation finishes, open Anastasis from this device’s Home Screen or apps.' : result === 'dismissed' ? 'Installation was dismissed. You can still use the browser-menu steps below.' : result === 'error' ? 'The installation prompt could not open or finish. Use the browser-menu steps below.' : ''}
          </p>
          {showSteps && <div ref={instructions} tabIndex={-1} className={styles.instructions}>
            <h3>How to add Anastasis</h3>
            {device === 'ios' ? <>
              <ol>
                <li>Open your browser’s <strong>Share</strong> menu. It may be inside the browser menu.</li>
                <li>Choose <strong>Add to Home Screen</strong>. You may need to scroll through the actions.</li>
                <li>Leave <strong>Open as Web App</strong> on, if offered.</li>
                <li>Tap <strong>Add</strong>, then look for Anastasis on your Home Screen.</li>
              </ol>
              <p>If Add to Home Screen is missing, try opening this website in Safari and follow these steps there.</p>
            </> : device === 'desktop' ? <>
              <ol>
                <li>Open your browser’s menu or look for an install icon beside the address bar.</li>
                <li>Choose <strong>Install Anastasis</strong>, <strong>Install app</strong>, or a similar option, then confirm.</li>
              </ol>
              <p>If your browser has no install option, keep using Anastasis here or open this website on your phone to add it to that Home Screen.</p>
            </> : <>
              <ol>
                <li>Open your browser’s menu, usually the three dots near the address bar.</li>
                <li>Choose <strong>Add to Home Screen</strong> or <strong>Install app</strong>.</li>
                <li>Follow the browser’s confirmation and tap <strong>Add</strong> or <strong>Install</strong>.</li>
              </ol>
              <p>If the option is missing, open this website in a browser that supports installation, such as Chrome on Android. If you opened a link inside another app, open it in your phone’s browser first.</p>
            </>}
          </div>}
        </div>
        <footer className={styles.footer}>
          <button type="button" className={styles.primary} disabled={busy} onClick={() => {
            if (nativeAvailable) install()
            else if (showSteps) close()
            else setManual(true)
          }}>{busy ? 'Waiting for browser…' : nativeAvailable ? device === 'desktop' ? 'Install on this computer' : 'Add to Home Screen' : showSteps ? 'Done' : 'Show Home Screen steps'}</button>
        </footer>
      </div>
    </dialog>
  </>
}
