import { createClient } from '@/lib/supabase/client'
import {
  COMMUNITY_MEDIA_BUCKET,
  communityMediaError,
  type CommunityDraft,
  type CommunityPost,
  type CommunityPostInput,
  type CommunityReserveResponse,
} from './contracts'

export class CommunityRequestError extends Error {
  constructor(message: string, public status = 0, public code?: string) {
    super(message)
    this.name = 'CommunityRequestError'
  }
}

export function communityFileMime(file: Pick<File, 'name' | 'type'>): string {
  if (file.type) return file.type.toLowerCase()
  // Some mobile pickers leave MIME empty. A known extension only supplies
  // the upload label; the server separately validates the actual bytes.
  const extension = file.name.split('.').pop()?.toLowerCase()
  const known: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', heic: 'image/heic', heif: 'image/heif' }
  return extension ? known[extension] || '' : ''
}

export async function communityRequest<T>(url: string, options: RequestInit = {}, fetcher = fetch): Promise<T> {
  const response = await fetcher(url, { ...options, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...options.headers } })
  const result = await response.json().catch(() => null)
  if (!response.ok) throw new CommunityRequestError(result?.error || 'Community could not be reached. Please try again.', response.status, result?.code)
  if (!result) throw new CommunityRequestError('The community response was incomplete. Please retry the same post.')
  return result as T
}

type UploadOptions = {
  file: File
  draft: CommunityDraft
  signal: AbortSignal
  onProgress: (percent: number) => void
  getAccessToken?: () => Promise<string | undefined>
  createXHR?: () => XMLHttpRequest
  storageUrl?: string
  publishableKey?: string
}

export async function uploadCommunityMedia({ file, draft, signal, onProgress, getAccessToken, createXHR = () => new XMLHttpRequest(), storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }: UploadOptions): Promise<void> {
  const invalid = communityMediaError(file.type, file.size)
  if (invalid) throw new CommunityRequestError(invalid, 400)
  if (file.type !== draft.mediaMime || file.size !== draft.mediaSize) throw new CommunityRequestError('Choose the original attachment for this pending post.', 400)
  if (signal.aborted) throw new DOMException('Upload canceled.', 'AbortError')
  const token = getAccessToken ? await getAccessToken() : (await createClient().auth.getSession()).data.session?.access_token
  if (!token) throw new CommunityRequestError('Your session has expired. Sign in again to continue this post.', 401)
  if (!storageUrl || !publishableKey) throw new CommunityRequestError('Community media is not configured yet.', 503)
  if (signal.aborted) throw new DOMException('Upload canceled.', 'AbortError')

  await new Promise<void>((resolve, reject) => {
    const xhr = createXHR()
    const abort = () => xhr.abort()
    const settle = (error?: Error) => {
      signal.removeEventListener('abort', abort)
      if (error) reject(error)
      else resolve()
    }
    xhr.open('POST', `${storageUrl.replace(/\/$/, '')}/storage/v1/object/${COMMUNITY_MEDIA_BUCKET}/${draft.mediaPath.split('/').map(encodeURIComponent).join('/')}`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', publishableKey)
    xhr.setRequestHeader('Content-Type', draft.mediaMime)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.timeout = 120_000
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(Math.min(100, Math.round(event.loaded / event.total * 100)))
    }
    xhr.onload = () => {
      // An earlier upload may have succeeded while its response was lost.
      // The server still validates that reserved object before publishing.
      let duplicate = false
      if (xhr.status === 400) {
        try {
          const result = JSON.parse(xhr.responseText)
          duplicate = String(result.statusCode) === '409' && result.error === 'Duplicate'
        } catch { /* Other failed uploads must remain failures. */ }
      }
      if (xhr.status >= 200 && xhr.status < 300 || xhr.status === 409 || duplicate) settle()
      else settle(new CommunityRequestError('The attachment could not be uploaded. Retry this post or discard it.', xhr.status))
    }
    xhr.onerror = () => settle(new CommunityRequestError('The attachment upload was interrupted. Retry this post to continue.'))
    xhr.ontimeout = () => settle(new CommunityRequestError('The attachment upload timed out. Retry this post to continue.'))
    xhr.onabort = () => settle(new DOMException('Upload canceled.', 'AbortError'))
    signal.addEventListener('abort', abort, { once: true })
    xhr.send(file)
  })
}

type SubmitOptions = {
  input: CommunityPostInput
  file: File | null
  signal: AbortSignal
  onStage: (stage: 'saving' | 'uploading' | 'publishing') => void
  onProgress: (percent: number) => void
  request?: typeof communityRequest
  upload?: typeof uploadCommunityMedia
}

export async function submitCommunityPost({ input, file, signal, onStage, onProgress, request = communityRequest, upload = uploadCommunityMedia }: SubmitOptions): Promise<CommunityPost> {
  onStage('saving')
  const result = await request<CommunityReserveResponse>('/api/community/posts', { method: 'POST', body: JSON.stringify(input), signal })
  if (result.post) return result.post
  if (!result.draft) throw new CommunityRequestError('The pending post could not be opened. Please retry.')
  if (file) {
    onStage('uploading')
    await upload({ file, draft: result.draft, signal, onProgress })
  }
  onStage('publishing')
  // Without a file after a reload, this also checks whether the prior upload
  // completed. MEDIA_MISSING keeps the same reservation for file selection.
  const published = await request<{ post: CommunityPost }>(`/api/community/posts/${input.id}/publish`, { method: 'POST', signal })
  return published.post
}
