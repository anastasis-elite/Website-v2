'use client'

import { useState } from 'react'
import * as styles from '@/app/styles/globalstyles'

const postTypes = [
  'Progress',
  'Win',
  'Question',
  'Encouragement',
  'Struggle',
  'Transformation',
]

export default function CreatePostBox() {
  const [body, setBody] = useState('')
  const [postType, setPostType] = useState('Progress')

  return (
    <section style={styles.cartBoxStyle}>
      <p style={styles.eyebrowStyle}>Share With The Pulse</p>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What are you noticing, celebrating, questioning, or working through today?"
        style={{
          ...styles.textareaStyle,
          minHeight: '120px',
          marginTop: '14px',
        }}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '14px',
          alignItems: 'center',
          marginTop: '16px',
          flexWrap: 'wrap',
        }}
      >
        <select
          value={postType}
          onChange={(e) => setPostType(e.target.value)}
          style={{
            ...styles.inputStyle,
            maxWidth: '220px',
          }}
        >
          {postTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={!body.trim()}
          style={{
            ...styles.primaryButtonStyle,
            opacity: body.trim() ? 1 : 0.5,
          }}
        >
          Post to The Pulse
        </button>
      </div>

      <p
        style={{
          ...styles.bodyStyle,
          fontSize: '0.78rem',
          marginTop: '14px',
          color: 'rgba(215,199,182,0.58)',
        }}
      >
        Keep it supportive. Derogatory, shaming, or hostile comments will not be
        allowed inside this community.
      </p>
    </section>
  )
}
