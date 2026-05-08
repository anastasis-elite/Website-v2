'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import * as styles from '../../../../../styles/globalstyles'

type ProgramData = {
  client_id?: string
  fullName?: string
  email?: string
  program?: string
  birthdate?: string
  height_in?: string
  weight?: string
  weight_goal?: string
  training_environment?: string
  program_output?: string
  plan?: string
  notes?: string
  [key: string]: any
}

function PlanContentInner() {
  const searchParams = useSearchParams()

  const program = searchParams.get('program') || ''
  const clientId = searchParams.get('client_id') || ''
  const fullName = searchParams.get('fullName') || ''
  const email = searchParams.get('email') || ''
  const birthdate = searchParams.get('birthdate') || ''

  const [data, setData] = useState<ProgramData | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function loadProgram() {
      try {
        const res = await fetch(
          `/api/program/client?program=${encodeURIComponent(
            program
          )}&client_id=${encodeURIComponent(clientId)}&email=${encodeURIComponent(email)}`
        )

        const result = await res.json()

        if (!res.ok) {
          throw new Error(result.error || 'Program could not be loaded.')
        }

        setData(result.client || result.program || result)
        setStatus('ready')
      } catch (error) {
        console.error('PROGRAM LOAD ERROR:', error)
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'Something went wrong.')
      }
    }

    if (clientId || email) {
      loadProgram()
    } else {
      setStatus('error')
      setMessage('Missing client information.')
    }
  }, [program, clientId, email])

  const displayName = data?.fullName || fullName || 'Client'
  const displayProgram = data?.program || program
  const displayBirthdate = data?.birthdate || birthdate

  const programOutput =
    data?.program_output ||
    data?.plan ||
    data?.output ||
    data?.programPlan ||
    ''

  return (
    <main style={styles.pageStyle}>
      <div style={styles.containerStyle}>
        <p style={styles.eyebrowStyle}>Program Output</p>

        <h1 style={styles.heroTitleStyle}>
          {displayName}, your plan is being built.
        </h1>

        <p style={styles.heroTextStyle}>
          This page pulls from your client row and displays the program output created
          from your assessment data.
        </p>

        <section style={styles.cartBoxStyle}>
          <h2 style={styles.sectionTitleStyle}>Client Details</h2>

          <p style={styles.bodyStyle}>
            <strong>Name:</strong> {displayName}
          </p>

          <p style={styles.bodyStyle}>
            <strong>Email:</strong> {data?.email || email}
          </p>

          <p style={styles.bodyStyle}>
            <strong>Client ID:</strong> {data?.client_id || clientId}
          </p>

          <p style={styles.bodyStyle}>
            <strong>Program:</strong> {displayProgram}
          </p>

          {displayBirthdate ? (
            <p style={styles.bodyStyle}>
              <strong>Birthdate:</strong> {displayBirthdate}
            </p>
          ) : null}
        </section>

        {status === 'loading' ? (
          <section style={styles.cartBoxStyle}>
            <h2 style={styles.sectionTitleStyle}>Loading Program...</h2>
            <p style={styles.bodyStyle}>
              Pulling the client row and program output now.
            </p>
          </section>
        ) : null}

        {status === 'error' ? (
          <section style={styles.cartBoxStyle}>
            <h2 style={styles.sectionTitleStyle}>Program Not Found Yet</h2>
            <p style={{ ...styles.bodyStyle, color: '#ffb4b4' }}>
              {message}
            </p>
          </section>
        ) : null}

        {status === 'ready' ? (
          <section style={styles.cartBoxStyle}>
            <h2 style={styles.sectionTitleStyle}>Your Program</h2>

            {programOutput ? (
              <pre
                style={{
                  ...styles.bodyStyle,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.7,
                  fontFamily: 'inherit',
                }}
              >
                {programOutput}
              </pre>
            ) : (
              <p style={styles.bodyStyle}>
                The client row loaded, but no program output field was found yet.
              </p>
            )}
          </section>
        ) : null}
      </div>
    </main>
  )
}

export default function PlanContent() {
  return (
    <Suspense fallback={null}>
      <PlanContentInner />
    </Suspense>
  )
}
