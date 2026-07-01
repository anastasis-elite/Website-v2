'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import * as styles from '@/app/styles/globalstyles'

export type PhoenixTask = {
  id: string
  title: string
  detail: string
  block: 'morning' | 'midday' | 'evening'
  time: string
  href?: string
  actionLabel?: string
}

export default function PhoenixExecutionFlow({
  clientId,
  executionStyle,
  dashboardStyle,
  tasks,
}: {
  clientId: string
  executionStyle: string
  dashboardStyle: string
  tasks: PhoenixTask[]
}) {
  const [completed, setCompleted] = useState<string[]>([])
  const storageKey = `phoenix-tasks:${clientId}:${new Date().toISOString().slice(0, 10)}`
  const itemized = dashboardStyle === 'step'
  const structured = executionStyle === 'schedule'

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey)
    if (saved) setCompleted(JSON.parse(saved))
  }, [storageKey])

  function complete(id: string) {
    const next = completed.includes(id) ? completed.filter((item) => item !== id) : [...completed, id]
    setCompleted(next)
    window.localStorage.setItem(storageKey, JSON.stringify(next))
  }

  const sortedTasks = useMemo(() => [...tasks].sort((a, b) => a.time.localeCompare(b.time)), [tasks])
  const remaining = sortedTasks.filter((task) => !completed.includes(task.id))
  const nextTask = structured
    ? remaining.find((task) => task.time >= currentTime()) || remaining[0]
    : remaining[0]

  if (itemized) {
    return (
      <section style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>{structured ? 'Next Timed Event' : 'Your Next Step'}</p>
        {nextTask ? (
          <TaskFocus task={nextTask} structured={structured} onComplete={() => complete(nextTask.id)} />
        ) : (
          <><h2 style={styles.sectionTitleStyle}>Today is complete.</h2><p style={styles.bodyStyle}>Nothing else is required.</p></>
        )}
      </section>
    )
  }

  return (
    <section>
      <div style={carouselStyle}>
        {(['morning', 'midday', 'evening'] as const).map((block) => (
          <div key={block} style={blockCardStyle}>
            <p style={styles.eyebrowStyle}>{blockWindow(block)}</p>
            <h2 style={styles.sectionTitleStyle}>{capitalize(block)}</h2>
            <div style={{ display: 'grid', gap: '14px' }}>
              {sortedTasks.filter((task) => (structured ? blockForTime(task.time) : task.block) === block).map((task) => (
                <TaskRow key={task.id} task={task} structured={structured} checked={completed.includes(task.id)} onChange={() => complete(task.id)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function TaskFocus({ task, structured, onComplete }: { task: PhoenixTask; structured: boolean; onComplete: () => void }) {
  return (
    <div>
      {structured ? <p style={timeStyle}>{formatTime(task.time)}</p> : null}
      <h2 style={styles.sectionTitleStyle}>{task.title}</h2>
      <p style={styles.bodyStyle}>{task.detail}</p>
      <div style={styles.buttonRowStyle}>
        {task.href ? <Link href={task.href} style={styles.primaryButtonStyle}>{task.actionLabel || 'Open'}</Link> : null}
        <button type="button" onClick={onComplete} style={task.href ? styles.secondaryButtonStyle : styles.primaryButtonStyle}>I’ve Done This</button>
      </div>
    </div>
  )
}

function TaskRow({ task, structured, checked, onChange }: { task: PhoenixTask; structured: boolean; checked: boolean; onChange: () => void }) {
  return (
    <div style={{ ...taskRowStyle, opacity: checked ? 0.55 : 1 }}>
      <label style={checkLabelStyle}>
        <input type="checkbox" checked={checked} onChange={onChange} />
        <span><strong>{structured ? `${formatTime(task.time)} · ` : ''}{task.title}</strong><small style={detailStyle}>{task.detail}</small></span>
      </label>
      {task.href && !checked ? <Link href={task.href} style={styles.secondaryButtonStyle}>{task.actionLabel || 'Open'}</Link> : null}
    </div>
  )
}

function currentTime() { return new Date().toTimeString().slice(0, 5) }
function formatTime(value: string) { const [h, m] = value.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}` }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1) }
function blockWindow(block: string) { return block === 'morning' ? '3:00 AM–10:00 AM' : block === 'midday' ? '10:00 AM–3:00 PM' : '3:00 PM–10:00 PM' }
function blockForTime(time: string): PhoenixTask['block'] { const hour = Number(time.split(':')[0]); return hour < 10 ? 'morning' : hour < 15 ? 'midday' : 'evening' }

const carouselStyle = { display: 'flex', gap: '22px', overflowX: 'auto', scrollSnapType: 'x mandatory', padding: '8px 4px 28px' } as const
const blockCardStyle = { ...styles.cartBoxStyle, flex: '0 0 min(86vw, 620px)', scrollSnapAlign: 'center', marginBottom: 0, minHeight: '430px' } as const
const taskRowStyle = { display: 'grid', gap: '12px', padding: '16px', borderRadius: '20px', background: 'rgba(255,255,255,.035)' } as const
const checkLabelStyle = { display: 'flex', alignItems: 'flex-start', gap: '12px', color: '#f5f0e8', lineHeight: 1.5, cursor: 'pointer' } as const
const detailStyle = { display: 'block', color: '#d7c7b6', fontWeight: 400, marginTop: '5px' } as const
const timeStyle = { color: '#c58b57', fontSize: '1.1rem', fontWeight: 600 } as const
