'use client'

import { useState } from 'react'
import * as styles from '@/app/styles/globalstyles'
import CreatePostBox from './CreatePostBox'
import PostCard from './PostCard'

type CommunityCategory =
  | 'All'
  | 'Progress'
  | 'Wins'
  | 'Questions'
  | 'Encouragement'
  | 'Struggle'
  | 'Transformation'

const categories: CommunityCategory[] = [
  'All',
  'Progress',
  'Wins',
  'Questions',
  'Encouragement',
  'Struggle',
  'Transformation',
]

const samplePosts = [
  {
    id: '1',
    name: 'Maya R.',
    badge: 'Ignite Member',
    category: 'Progress',
    time: '18 min ago',
    body: 'Today was the first day I noticed my recovery felt better than my motivation. I still showed up, but it didn’t feel like I had to fight myself to do it.',
    supports: 12,
    comments: [
      {
        id: 'c1',
        name: 'Alina',
        body: 'That is such a huge nervous system win.',
      },
    ],
  },
  {
    id: '2',
    name: 'Kara T.',
    badge: 'Phoenix Member',
    category: 'Wins',
    time: '1 hr ago',
    body: 'My waist measurement didn’t change much this week, but my hip and thigh measurements did. I would have missed this completely if I was only watching the scale.',
    supports: 21,
    comments: [],
  },
  {
    id: '3',
    name: 'Sienna M.',
    badge: 'Ember Member',
    category: 'Question',
    time: '3 hrs ago',
    body: 'Does anyone else notice they feel stronger right before ovulation but more inflamed before their period?',
    supports: 8,
    comments: [
      {
        id: 'c2',
        name: 'Rhea',
        body: 'Yes. That can be a very real pattern. Keep tracking it so the system can see your trend over time.',
      },
    ],
  },
]

export default function CommunityFeed() {
  const [activeCategory, setActiveCategory] =
    useState<CommunityCategory>('All')

  const filteredPosts =
    activeCategory === 'All'
      ? samplePosts
      : samplePosts.filter((post) => post.category === activeCategory)

  return (
    <main style={{ display: 'grid', gap: '28px' }}>
      <section style={styles.cartBoxStyle}>
        <p style={styles.eyebrowStyle}>The Pulse</p>

        <h1 style={styles.sectionTitleStyle}>Member Community</h1>

        <p style={styles.bodyStyle}>
          Share your progress, ask for support, and celebrate the women building
          beside you. This is a regulated support space — not a comment section.
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            marginTop: '24px',
          }}
        >
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              style={{
                border:
                  activeCategory === category
                    ? '1px solid rgba(197,139,87,0.95)'
                    : '1px solid rgba(245,240,232,0.14)',
                background:
                  activeCategory === category
                    ? 'rgba(197,139,87,0.16)'
                    : 'rgba(255,255,255,0.03)',
                color:
                  activeCategory === category
                    ? '#f5f0e8'
                    : 'rgba(245,240,232,0.72)',
                borderRadius: '999px',
                padding: '9px 14px',
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      <CreatePostBox />

      <section style={{ display: 'grid', gap: '18px' }}>
        {filteredPosts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </section>
    </main>
  )
}
