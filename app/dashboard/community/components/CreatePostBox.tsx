'use client'

import { useEffect, useRef, useState } from 'react'
import * as styles from '@/app/styles/globalstyles'
import { COMMUNITY_BODY_LIMIT, COMMUNITY_CATEGORIES, COMMUNITY_MEDIA_FORMATS, communityMediaError, validCommunityId, type CommunityCategory, type CommunityMediaMime, type CommunityPost, type CommunityPostInput } from '@/lib/community/contracts'
import { CommunityRequestError, communityFileMime, communityRequest, submitCommunityPost } from '@/lib/community/browser'

type PendingPost = { input: CommunityPostInput; fileName: string | null }
type Stage = 'saving' | 'uploading' | 'publishing' | 'discarding' | null

export default function CreatePostBox({ viewerId, onPosted }: { viewerId: string; onPosted: (post: CommunityPost) => void }) {
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<CommunityCategory>('Progress')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingPost | null>(null)
  const [stage, setStage] = useState<Stage>(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [restored, setRestored] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const working = useRef(false)
  const cancelUpload = useRef(false)
  const mounted = useRef(true)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const key = `community-pending:${viewerId}`

  useEffect(() => {
    mounted.current = true
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || 'null') as PendingPost | null
      if (saved && validCommunityId(saved.input?.id) && typeof saved.input.body === 'string' && saved.input.body.length <= COMMUNITY_BODY_LIMIT && COMMUNITY_CATEGORIES.includes(saved.input.category) && (!saved.input.media || !communityMediaError(saved.input.media.mimeType, saved.input.media.size))) {
        setPending({ input: saved.input, fileName: typeof saved.fileName === 'string' ? saved.fileName : null })
        setBody(saved.input.body)
        setCategory(saved.input.category)
        setNotice('A previous post is pending. Retry to check whether it was shared, or discard it before starting another.')
      }
    } catch { /* A damaged local draft must not prevent opening the composer. */ }
    setRestored(true)
    return () => {
      mounted.current = false
      controller.current?.abort()
    }
  }, [key])

  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function remember(value: PendingPost | null) {
    setPending(value)
    try {
      if (value) sessionStorage.setItem(key, JSON.stringify(value))
      else sessionStorage.removeItem(key)
    } catch { /* Retry identity still survives in component state. */ }
  }

  function reset() {
    remember(null)
    setBody('')
    setFile(null)
    setProgress(0)
    if (fileInput.current) fileInput.current.value = ''
  }

  function chooseFile(selected: File | undefined) {
    if (!selected) return
    setError('')
    const mime = communityFileMime(selected)
    const invalid = communityMediaError(mime, selected.size)
    if (invalid) { setError(invalid); if (fileInput.current) fileInput.current.value = ''; return }
    if (pending && (pending.input.media?.mimeType !== mime || pending.input.media.size !== selected.size)) {
      setError('Choose the original attachment for this pending post, or discard the post to start again.')
      if (fileInput.current) fileInput.current.value = ''
      return
    }
    setFile(selected.type === mime ? selected : new File([selected], selected.name, { type: mime, lastModified: selected.lastModified }))
    setNotice('')
  }

  async function discard(id = pending?.input.id) {
    if (!id) { reset(); return }
    working.current = true
    setStage('discarding')
    setError('')
    try {
      await communityRequest(`/api/community/posts/${id}`, { method: 'DELETE' })
      if (!mounted.current) return
      reset()
      setNotice('Post discarded.')
    } catch (failure) {
      if (mounted.current) setError(`${failure instanceof Error ? failure.message : 'The pending post could not be discarded.'} Your pending post is kept here. Retry discarding before starting another.`)
    } finally { working.current = false; if (mounted.current) setStage(null) }
  }

  async function submit() {
    if (working.current || !restored) return
    setError('')
    setNotice('')
    const attempt = pending || {
      input: { id: crypto.randomUUID(), body: body.trim(), category, media: file ? { mimeType: file.type as CommunityMediaMime, size: file.size } : null },
      fileName: file?.name || null,
    }
    if (!attempt.input.body && !attempt.input.media) { setError('Write a post or choose a photo or video.'); return }
    working.current = true
    remember(attempt)
    const abort = new AbortController()
    controller.current = abort
    cancelUpload.current = false
    setProgress(0)
    try {
      const post = await submitCommunityPost({
        input: attempt.input,
        file,
        signal: abort.signal,
        onStage: (next) => { if (mounted.current) setStage(next) },
        onProgress: (percent) => { if (mounted.current) setProgress(percent) },
      })
      if (!mounted.current) return
      reset()
      setNotice('Your post is shared with the member community.')
      onPosted(post)
    } catch (failure) {
      if (!mounted.current) return
      if (cancelUpload.current) {
        await discard(attempt.input.id)
      } else if (failure instanceof CommunityRequestError && failure.code === 'MEDIA_MISSING') {
        setError('The attachment has not finished uploading. Choose the original file below, then retry this post.')
      } else {
        setError(`${failure instanceof Error ? failure.message : 'The post could not be shared.'} Retry keeps the same post, so it will not be shared twice.`)
      }
    } finally {
      working.current = false
      if (mounted.current) setStage(null)
      controller.current = null
    }
  }

  const busy = stage !== null
  const locked = busy || pending !== null || !restored
  const attachmentType = file ? COMMUNITY_MEDIA_FORMATS[file.type as CommunityMediaMime]?.kind : null

  return <section style={styles.cartBoxStyle} aria-label="Create a community post" aria-busy={busy}>
    <p style={styles.eyebrowStyle}>Share with the community</p>
    <label htmlFor="community-post-body" style={{ ...styles.labelStyle, display: 'block', marginTop: 14 }}>Your post</label>
    <textarea id="community-post-body" value={body} onChange={(event) => setBody(event.target.value)} disabled={locked} maxLength={COMMUNITY_BODY_LIMIT} placeholder="Share a win, ask a question, or tell us how your day is going…" style={{ ...styles.textareaStyle, minHeight: 120 }} />
    <p className="phone-app-community-note" style={{ marginTop: 4 }}>{body.length} / {COMMUNITY_BODY_LIMIT}</p>

    <label htmlFor="community-post-category" style={{ ...styles.labelStyle, display: 'block' }}>Topic</label>
    <select id="community-post-category" value={category} disabled={locked} onChange={(event) => setCategory(event.target.value as CommunityCategory)} style={{ ...styles.inputStyle, maxWidth: 240 }}>
      {COMMUNITY_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
    </select>

    <div style={{ marginTop: 18 }}>
      <label htmlFor="community-post-media" style={{ ...styles.labelStyle, display: 'block' }}>{pending ? 'Original attachment, if upload needs retrying' : 'Add one photo or video (optional)'}</label>
      <input ref={fileInput} id="community-post-media" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,.jpg,.jpeg,.png,.webp,.mp4,.mov,.webm" disabled={busy || !!pending && !pending.input.media || !!file && !!pending || !restored} onChange={(event) => chooseFile(event.target.files?.[0])} aria-describedby="community-media-limits" style={{ display: 'block', width: '100%', marginTop: 8, color: '#f5f0e8' }} />
      <p id="community-media-limits" className="phone-app-community-note">One JPEG, PNG or WebP photo up to 10 MB, or MP4, MOV or WebM video up to 50 MB. Export HEIC/HEIF photos as JPEG. Some iPhone video codecs may not play on every device; use H.264 MP4 for wider playback. Media is shared only when you post.</p>
      {preview && file ? <div style={{ marginTop: 12 }}>
        {attachmentType === 'video' ? <video key={preview} src={preview} controls playsInline preload="metadata" aria-label="Attachment preview" style={{ width: '100%', maxHeight: 340, borderRadius: 12 }} /> : <img src={preview} alt="Selected photo preview" style={{ width: '100%', maxHeight: 340, objectFit: 'contain', borderRadius: 12 }} />}
        <p className="phone-app-community-note" style={{ overflowWrap: 'anywhere' }}>{file.name}</p>
        {!pending && <button type="button" disabled={busy} onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = '' }} style={styles.secondaryButtonStyle}>Remove attachment</button>}
      </div> : pending?.fileName ? <p className="phone-app-community-note" style={{ overflowWrap: 'anywhere' }}>Pending attachment: {pending.fileName}. Retry checks whether its upload already finished.</p> : null}
    </div>

    {stage === 'uploading' ? <div role="status" style={{ marginTop: 14 }}><label htmlFor="community-upload-progress">Uploading attachment: {progress}%</label><progress id="community-upload-progress" max={100} value={progress} style={{ display: 'block', width: '100%', marginTop: 8 }} /></div> : stage ? <p role="status" className="phone-app-community-note">{stage === 'saving' ? 'Saving your post…' : stage === 'publishing' ? 'Checking the attachment and sharing your post…' : 'Discarding your post and attachment…'}</p> : null}
    {error && <p role="alert" style={{ color: '#ffb4b4', lineHeight: 1.5 }}>{error}</p>}
    {notice && <p role="status" className="phone-app-community-note">{notice}</p>}

    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 18 }}>
      <button type="button" onClick={submit} disabled={busy || !restored || !pending && !body.trim() && !file} style={{ ...styles.primaryButtonStyle, opacity: busy || !pending && !body.trim() && !file ? .5 : 1 }}>{pending ? 'Retry pending post' : 'Share post'}</button>
      {pending && !busy && <button type="button" onClick={() => discard()} style={styles.secondaryButtonStyle}>Discard pending post</button>}
      {stage === 'uploading' && <button type="button" onClick={() => { cancelUpload.current = true; controller.current?.abort() }} style={styles.secondaryButtonStyle}>Cancel upload and discard</button>}
    </div>
    {pending && <p className="phone-app-community-note">Your pending post is locked until it is shared or discarded. This protects against duplicate posts after a connection problem.</p>}
  </section>
}
