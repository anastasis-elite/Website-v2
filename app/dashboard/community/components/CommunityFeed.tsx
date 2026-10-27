'use client'

import { useState } from 'react'
import * as styles from '@/app/styles/globalstyles'
import CreatePostBox from './CreatePostBox'
import PostCard from './PostCard'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'

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
    badge: 'Example Ignite member',
    category: 'Progress',
    time: 'Sample post',
    body: 'I have a full day ahead. I’m choosing a shorter workout and leaving room to adjust if plans change.',
    supports: 12,
    comments: [
      {
        id: 'c1',
        name: 'Alina',
        body: 'That sounds like a manageable next step for today.',
      },
    ],
  },
  {
    id: '2',
    name: 'Kara T.',
    badge: 'Example Phoenix member',
    category: 'Wins',
    time: 'Sample post',
    body: 'I’m setting aside a few minutes this week to review what I recorded and decide what to carry forward.',
    supports: 21,
    comments: [],
  },
  {
    id: '3',
    name: 'Sienna M.',
    badge: 'Example Ember member',
    category: 'Question',
    time: 'Sample post',
    body: 'When your available time changes, how do you choose which activity to move first?',
    supports: 8,
    comments: [
      {
        id: 'c2',
        name: 'Rhea',
        body: 'I would start with the fixed commitments, then look at what still fits.',
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
      : samplePosts.filter((post) => post.category === activeCategory || activeCategory === 'Questions' && post.category === 'Question')

  return (
    <PhoneAppFrame eyebrow="Together" title="Community" subtitle="Room for every part of your day."><main className="phone-app-community">
        <p className="phone-app-community-note">
          These conversations, names, and counts are fictional examples.
          Posting is unavailable. Support and replies stay on this screen
          without being saved or shared.
        </p>

        <nav className="phone-app-topics" aria-label="Community topics">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              aria-pressed={activeCategory === category}
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
              <span className="phone-app-topic-icon" aria-hidden="true">{category === 'All' ? '◎' : <img alt="" src={`/illustrations/today-${category === 'Progress' || category === 'Transformation' ? 'training' : category === 'Wins' ? 'check-in' : category === 'Questions' ? 'schedule' : 'recovery'}.svg`} />}</span><span>{category}</span>
            </button>
          ))}
        </nav>
        <p className="phone-app-community-note">Mixed feed · Following, saved posts and media sharing are unavailable in this preview.</p>

      <CreatePostBox />

      <section style={{ display: 'grid', gap: '18px' }}>
        {filteredPosts.length ? filteredPosts.map((post) => (
          <PostCard key={post.id} post={post} />
        )) : <p>No sample conversations in this topic yet.</p>}
      </section>
    </main></PhoneAppFrame>
  )
}
