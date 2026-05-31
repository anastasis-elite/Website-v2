'use client'

import { useState } from 'react'
import * as styles from '@/app/styles/globalstyles'

type Comment = {
  id: string
  name: string
  body: string
}

type Post = {
  id: string
  name: string
  badge: string
  category: string
  time: string
  body: string
  supports: number
  comments: Comment[]
}

const blockedWords = ['stupid', 'idiot', 'ugly', 'worthless']

function isSupportiveComment(comment: string) {
  const lower = comment.toLowerCase()
  return !blockedWords.some((word) => lower.includes(word))
}

export default function PostCard({ post }: { post: Post }) {
  const [supported, setSupported] = useState(false)
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState(post.comments)
  const [error, setError] = useState('')

  function submitComment() {
    setError('')

    if (!comment.trim()) return

    if (comment.length > 280) {
      setError('Comments must stay under 280 characters.')
      return
    }

    if (!isSupportiveComment(comment)) {
      setError('This space only allows supportive, respectful comments.')
      return
    }

    setComments((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: 'You',
        body: comment.trim(),
      },
    ])

    setComment('')
  }

  return (
    <article style={styles.cartBoxStyle}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '18px',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ display: 'flex', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle at 35% 30%, rgba(197,139,87,0.95), rgba(72,40,26,0.9))',
              display: 'grid',
              placeItems: 'center',
              color: '#0e0d0c',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {post.name.charAt(0)}
          </div>

          <div>
            <h3
              style={{
                margin: 0,
                color: '#f5f0e8',
                fontSize: '1rem',
                fontWeight: 500,
              }}
            >
              {post.name}
            </h3>

            <p
              style={{
                margin: '4px 0 0',
                color: 'rgba(215,199,182,0.62)',
                fontSize: '0.78rem',
              }}
            >
              {post.badge} · {post.time}
            </p>
          </div>
        </div>

        <span
          style={{
            border: '1px solid rgba(197,139,87,0.35)',
            color: '#c58b57',
            borderRadius: '999px',
            padding: '6px 10px',
            fontSize: '0.72rem',
            whiteSpace: 'nowrap',
          }}
        >
          {post.category}
        </span>
      </div>

      <p
        style={{
          ...styles.bodyStyle,
          marginTop: '18px',
          color: 'rgba(245,240,232,0.88)',
        }}
      >
        {post.body}
      </p>

      <div
        style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          marginTop: '18px',
        }}
      >
        <button
          type="button"
          onClick={() => setSupported((prev) => !prev)}
          style={{
            border: '1px solid rgba(245,240,232,0.14)',
            background: supported
              ? 'rgba(197,139,87,0.18)'
              : 'rgba(255,255,255,0.03)',
            color: supported ? '#c58b57' : 'rgba(245,240,232,0.76)',
            borderRadius: '999px',
            padding: '8px 12px',
            cursor: 'pointer',
          }}
        >
          Support · {post.supports + (supported ? 1 : 0)}
        </button>

        <span
          style={{
            color: 'rgba(215,199,182,0.48)',
            fontSize: '0.82rem',
          }}
        >
          {comments.length} comments
        </span>
      </div>

      <div style={{ display: 'grid', gap: '10px', marginTop: '18px' }}>
        {comments.map((item) => (
          <div
            key={item.id}
            style={{
              background: 'rgba(255,255,255,0.035)',
              border: '1px solid rgba(245,240,232,0.08)',
              borderRadius: '18px',
              padding: '12px 14px',
            }}
          >
            <p
              style={{
                margin: 0,
                color: '#f5f0e8',
                fontSize: '0.82rem',
              }}
            >
              {item.name}
            </p>

            <p
              style={{
                margin: '5px 0 0',
                color: 'rgba(215,199,182,0.72)',
                fontSize: '0.86rem',
                lineHeight: 1.5,
              }}
            >
              {item.body}
            </p>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          gap: '10px',
          marginTop: '14px',
        }}
      >
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add supportive comment..."
          style={styles.inputStyle}
        />

        <button
          type="button"
          onClick={submitComment}
          style={styles.secondaryButtonStyle}
        >
          Reply
        </button>
      </div>

      {error ? (
        <p
          style={{
            ...styles.bodyStyle,
            color: '#ffb4b4',
            fontSize: '0.8rem',
            marginTop: '10px',
          }}
        >
          {error}
        </p>
      ) : null}
    </article>
  )
}
