'use client'

import { useState } from 'react'
import * as styles from '@/app/styles/globalstyles'
import { COMMUNITY_REPORT_REASONS, type CommunityPost, type CommunityReportReason } from '@/lib/community/contracts'
import { communityRequest } from '@/lib/community/browser'

export default function PostCard({ post, viewerId, onDeleted }: { post: CommunityPost; viewerId: string; onDeleted: (id: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reason, setReason] = useState<CommunityReportReason>('spam')
  const [reported, setReported] = useState(false)
  const [error, setError] = useState('')
  const [mediaError, setMediaError] = useState(false)
  const [mediaVersion, setMediaVersion] = useState(0)
  const ownPost = post.authorId === viewerId

  async function remove() {
    if (busy) return
    setBusy(true); setError('')
    try { await communityRequest(`/api/community/posts/${post.id}`, { method: 'DELETE' }); onDeleted(post.id) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'This post could not be deleted. Please retry.') }
    finally { setBusy(false) }
  }

  async function report() {
    if (busy) return
    setBusy(true); setError('')
    try {
      await communityRequest(`/api/community/posts/${post.id}/report`, { method: 'POST', body: JSON.stringify({ reason }) })
      setReported(true); setShowReport(false)
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Your report could not be saved. Please retry.') }
    finally { setBusy(false) }
  }

  const mediaUrl = post.media ? `${post.media.url}${post.media.url.includes('?') ? '&' : '?'}retry=${mediaVersion}` : ''
  return <article style={styles.cartBoxStyle} aria-busy={busy}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}>
      <div style={{ minWidth: 0 }}><h3 style={{ margin: 0, fontSize: '1rem', color: '#f5f0e8', overflowWrap: 'anywhere' }}>{post.authorName}{ownPost ? ' · You' : ''}</h3><p className="phone-app-community-note" style={{ marginTop: 5 }}><time dateTime={post.publishedAt}>{new Date(post.publishedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time></p></div>
      <span style={{ border: '1px solid rgba(197,139,87,.35)', color: '#c58b57', borderRadius: 999, padding: '6px 10px', fontSize: '.72rem' }}>{post.category}</span>
    </div>
    {post.body && <p style={{ ...styles.bodyStyle, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: '#f5f0e8', marginTop: 18 }}>{post.body}</p>}
    {post.media && <div style={{ marginTop: 16 }}>
      {post.media.type === 'video' ? <video key={mediaUrl} controls playsInline preload="metadata" src={mediaUrl} onError={() => setMediaError(true)} aria-label={`Video shared by ${post.authorName}`} style={{ display: 'block', width: '100%', maxHeight: 480, borderRadius: 12 }} /> : <img key={mediaUrl} src={mediaUrl} alt={`Photo shared by ${post.authorName}`} loading="lazy" onError={() => setMediaError(true)} style={{ display: 'block', width: '100%', maxHeight: 480, objectFit: 'contain', borderRadius: 12 }} />}
      {mediaError && <div role="status"><p className="phone-app-community-note">{post.media.type === 'video' ? 'This video could not play. Your device may not support its codec, or the connection may have been interrupted.' : 'This photo could not load. Check your connection and try again.'}</p><button type="button" onClick={() => { setMediaError(false); setMediaVersion((value) => value + 1) }} style={styles.secondaryButtonStyle}>Retry media</button></div>}
    </div>}
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
      {ownPost ? <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)} style={styles.secondaryButtonStyle}>Delete post</button> : <button type="button" disabled={busy || reported} onClick={() => setShowReport((value) => !value)} style={styles.secondaryButtonStyle}>{reported ? 'Report recorded' : 'Report post'}</button>}
    </div>
    {confirmDelete && <div style={{ marginTop: 14 }}><p className="phone-app-community-note">Delete this post and its attachment? This cannot be undone.</p><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}><button type="button" disabled={busy} onClick={remove} style={styles.primaryButtonStyle}>{busy ? 'Deleting…' : 'Yes, delete post'}</button><button type="button" disabled={busy} onClick={() => setConfirmDelete(false)} style={styles.secondaryButtonStyle}>Keep post</button></div></div>}
    {showReport && <div style={{ marginTop: 14 }}><label htmlFor={`report-reason-${post.id}`} style={styles.labelStyle}>Reason for reporting</label><select id={`report-reason-${post.id}`} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value as CommunityReportReason)} style={{ ...styles.inputStyle, margin: '8px 0', textTransform: 'capitalize' }}>{COMMUNITY_REPORT_REASONS.map((item) => <option key={item} value={item}>{item}</option>)}</select><p className="phone-app-community-note">Reports are recorded for the community owner. Reporting does not automatically remove a post or confirm that someone has reviewed it.</p><button type="button" disabled={busy} onClick={report} style={styles.primaryButtonStyle}>{busy ? 'Sending…' : 'Send report'}</button></div>}
    {reported && <p role="status" className="phone-app-community-note">Your report was recorded. It has not been confirmed as reviewed.</p>}
    {error && <p role="alert" style={{ color: '#ffb4b4', lineHeight: 1.5 }}>{error}</p>}
  </article>
}
