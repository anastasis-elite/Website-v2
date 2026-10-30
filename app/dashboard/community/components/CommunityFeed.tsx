'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as styles from '@/app/styles/globalstyles'
import CreatePostBox from './CreatePostBox'
import PostCard from './PostCard'
import PhoneAppFrame from '@/components/phone-app/PhoneAppFrame'
import { COMMUNITY_CATEGORIES, type CommunityCategory, type CommunityPost } from '@/lib/community/contracts'
import { CommunityRequestError, communityRequest } from '@/lib/community/browser'

type FeedResponse = { posts: CommunityPost[]; viewerId: string; nextCursor: string | null }

export default function CommunityFeed() {
  const [activeCategory, setActiveCategory] = useState<CommunityCategory | 'All'>('All')
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [viewerId, setViewerId] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  const alive = useRef(true)

  const load = useCallback(async (cursor?: string) => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true); setError('')
    try {
      const result = await communityRequest<FeedResponse>(`/api/community/posts${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`)
      if (!alive.current) return
      setPosts((current) => cursor ? Array.from(new Map([...current, ...result.posts].map((post) => [post.id, post])).values()) : result.posts)
      setViewerId(result.viewerId)
      setNextCursor(result.nextCursor || null)
      setLoaded(true)
    } catch (failure) {
      if (alive.current) {
        if (failure instanceof CommunityRequestError && (failure.status === 401 || failure.status === 403)) {
          setPosts([])
          setViewerId(null)
          setNextCursor(null)
        }
        setError(failure instanceof Error ? failure.message : 'Community posts could not load. Please retry.')
      }
    } finally {
      inFlight.current = false
      if (alive.current) setBusy(false)
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void load()
    return () => { alive.current = false }
  }, [load])

  const filtered = activeCategory === 'All' ? posts : posts.filter((post) => post.category === activeCategory)
  return <PhoneAppFrame eyebrow="Together" title="Community" subtitle="Room for every part of your day."><main className="phone-app-community">
    <p className="phone-app-community-note">Share with other members. Only share photos and videos you want this community to see. Assessment photos stay separate.</p>
    <nav className="phone-app-topics" aria-label="Community topics">
      {(['All', ...COMMUNITY_CATEGORIES] as const).map((category) => <button key={category} type="button" aria-pressed={activeCategory === category} onClick={() => setActiveCategory(category)}>
        <span className="phone-app-topic-icon" aria-hidden="true">{category === 'All' ? '◎' : <img alt="" src={`/illustrations/today-${category === 'Progress' || category === 'Transformation' ? 'training' : category === 'Wins' ? 'check-in' : category === 'Questions' ? 'schedule' : 'recovery'}.svg`} />}</span><span>{category}</span>
      </button>)}
    </nav>
    {viewerId && <CreatePostBox key={viewerId} viewerId={viewerId} onPosted={(post) => setPosts((current) => [post, ...current.filter((item) => item.id !== post.id)])} />}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><h2 style={{ ...styles.sectionTitleStyle, margin: 0 }}>{activeCategory === 'All' ? 'Member posts' : activeCategory}</h2><button type="button" disabled={busy} onClick={() => load()} style={styles.secondaryButtonStyle}>Refresh</button></div>
    {busy && <p role="status" className="phone-app-community-note">{loaded ? 'Loading posts…' : 'Opening the community…'}</p>}
    {error && <div role="alert"><p style={{ color: '#ffb4b4' }}>{error}</p><button type="button" disabled={busy} onClick={() => load()} style={styles.secondaryButtonStyle}>Retry loading</button></div>}
    {loaded && !error && !filtered.length && <p className="phone-app-community-note">{activeCategory === 'All' ? 'No posts yet. Share the first update with your community.' : `No ${activeCategory.toLowerCase()} posts in the loaded conversations yet.`}</p>}
    <div aria-label="Community posts" style={{ display: 'grid', gap: 18 }}>
      {filtered.map((post) => <PostCard key={post.id} post={post} viewerId={viewerId || ''} onDeleted={(id) => setPosts((current) => current.filter((item) => item.id !== id))} />)}
    </div>
    {nextCursor && <button type="button" disabled={busy} onClick={() => load(nextCursor)} style={styles.secondaryButtonStyle}>Load more posts</button>}
  </main></PhoneAppFrame>
}
