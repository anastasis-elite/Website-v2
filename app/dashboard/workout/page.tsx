'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { getClientData } from '../lib/supabase/getClient'

async function WorkoutRedirectContent() {
  const searchParams = useSearchParams()
  const client = await getClientData()
  
  const program = searchParams.get('program') || ''
  const clientId = searchParams.get('client_id') || ''
  const fullName = searchParams.get('fullName') || ''
  const email = searchParams.get('email') || ''
  const birthdate = searchParams.get('birthdate') || ''

  useEffect(() => {
    window.location.href = `/dashboard/program/${encodeURIComponent(
      program
    )}/plan/content?program=${encodeURIComponent(
      program
    )}&client_id=${encodeURIComponent(
      clientId
    )}&fullName=${encodeURIComponent(
      fullName
    )}&email=${encodeURIComponent(
      email
    )}&birthdate=${encodeURIComponent(birthdate)}`
  }, [program, clientId, fullName, email, birthdate])

  return null
}

export default function WorkoutRedirectPage() {
  return (
    <Suspense fallback={null}>
      <WorkoutRedirectContent />
    </Suspense>
  )
}
