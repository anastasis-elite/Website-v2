'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import * as styles from '@/app/styles/globalstyles'

export default function FreeCommunityJoin({ verificationFailed = false }: { verificationFailed?: boolean }) {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verified, setVerified] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(verificationFailed ? 'Email verification could not be completed. Sign in if you already verified, or request a new verification email by trying again.' : '')
  const lock = useRef(false)

  useEffect(() => {
    let active = true
    const supabase = createClient()
    const updateUser = (user: { email_confirmed_at?: string | null; user_metadata?: Record<string, unknown> } | null) => {
      if (!active) return
      setVerified(Boolean(user?.email_confirmed_at))
      const name = user?.user_metadata?.full_name
      if (typeof name === 'string') setFullName(current => current || name.slice(0, 120))
    }
    void supabase.auth.getUser().then(({ data }) => updateUser(data.user)).catch(() => {})
    const { data } = supabase.auth.onAuthStateChange((_event, session) => updateUser(session?.user || null))
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current) return
    const name = fullName.trim()
    if (!name || name.length > 120) { setMessage('Enter your name in 1–120 characters.'); return }
    lock.current = true; setBusy(true); setMessage('')
    try {
      if (!verified) {
        if (!email.trim() || password.length < 8) { setMessage('Enter your email and a password with at least 8 characters.'); return }
        const { data, error } = await createClient().auth.signUp({ email: email.trim(), password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=%2Fcommunity%2Fjoin`, data: { full_name: name } } })
        if (error) { setMessage('Account creation could not be completed. Try again, or sign in if you already have an account.'); return }
        setPassword('')
        if (!data.user?.email_confirmed_at || !data.session) {
          setMessage('Check your email to verify your account, then return here to finish joining. If you already have an account, sign in instead.')
          return
        }
        setVerified(true)
      }
      const response = await fetch('/api/membership/enroll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: name }) })
      const result = await response.json().catch(() => null)
      if (!response.ok || result?.success !== true) throw new Error(result?.error || 'Your Community profile could not be saved. Please retry.')
      router.push('/dashboard/community'); router.refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Joining could not be completed. Please retry.') }
    finally { lock.current = false; setBusy(false) }
  }

  return <main style={styles.pageStyle}><div style={styles.containerStyle}>
    <p style={styles.eyebrowStyle}>Free Community</p>
    <h1 style={styles.heroTitleStyle}>Join the Community.</h1>
    <p style={styles.heroTextStyle}>Create a verified account to take part in Community. Personalized coaching is separate. An existing paid membership stays unchanged.</p>
    <section style={styles.cartBoxStyle}><form onSubmit={submit}>
      <label style={styles.bodyStyle}>Your name<input style={styles.inputStyle} autoComplete="name" maxLength={120} value={fullName} onChange={event => setFullName(event.target.value)} required disabled={busy} /></label>
      {!verified ? <>
        <label style={styles.bodyStyle}>Email<input style={styles.inputStyle} type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required disabled={busy} /></label>
        <label style={styles.bodyStyle}>Password<input style={styles.inputStyle} type="password" autoComplete="new-password" minLength={8} value={password} onChange={event => setPassword(event.target.value)} required disabled={busy} /></label>
      </> : <p style={styles.bodyStyle}>Your email is verified. Finish saving your Community profile.</p>}
      <button style={styles.primaryButtonStyle} type="submit" disabled={busy}>{busy ? 'Saving…' : verified ? 'Open Community' : 'Create Free account'}</button>
      <p role="status" style={styles.bodyStyle}>{message}</p>
      <p style={styles.bodyStyle}><Link href="/login?redirect=%2Fcommunity%2Fjoin">Already have an account? Sign in.</Link></p>
    </form></section>
  </div></main>
}
