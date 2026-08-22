'use client'

import Image from 'next/image'
import { useEffect,useState } from 'react'
import { useRouter } from 'next/navigation'
import { AOSButton } from '@/components/aos-ui/AOSButton'
import { AOSChip } from '@/components/aos-ui/AOSChip'
import PostureLandmarkEditor from '@/components/PostureLandmarkEditor'
import { POSTURE_VIEW_LABELS, postureInstructions, type AssessmentView } from '@/lib/posture/landmarks'

type PhotoKey = 'front' | 'back' | 'left' | 'right'
type UploadedView = {
  view: AssessmentView
  path: string
  signedUrl: string
}

const photoFields: {
  key: PhotoKey
  label: string
  description: string
}[] = [
  {
    key: 'front',
    label: 'Front View',
    description: 'Stand relaxed, full body visible, camera at hip height.',
  },
  {
    key: 'back',
    label: 'Back View',
    description: 'Stand relaxed, full body visible, arms naturally at sides.',
  },
  {
    key: 'left',
    label: 'Left Side View',
    description: 'Stand naturally from the side, full body visible.',
  },
  {
    key: 'right',
    label: 'Right Side View',
    description: 'Stand naturally from the side, full body visible.',
  },
]

export default function AssessmentPhotoUpload({
  postureAssessmentEnabled = true,
}: {
  postureAssessmentEnabled?: boolean
}) {
  const router=useRouter()
  const [files, setFiles] = useState<Record<PhotoKey, File | null>>({
    front: null,
    back: null,
    left: null,
    right: null,
  })

  const [previews, setPreviews] = useState<Record<PhotoKey, string | null>>({
    front: null,
    back: null,
    left: null,
    right: null,
  })

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [assessmentType,setAssessmentType]=useState<'progress'|'posture'>('progress')
  const [uploadedRecordId, setUploadedRecordId] = useState<string | null>(null)
  const [uploadedViews, setUploadedViews] = useState<UploadedView[]>([])
  const [activeViewIndex, setActiveViewIndex] = useState(0)

  useEffect(()=>()=>{Object.values(previews).forEach((preview)=>{if(preview)URL.revokeObjectURL(preview)})},[previews])

  function handleFileChange(key: PhotoKey, file: File | null) {
    setFiles((prev) => ({
      ...prev,
      [key]: file,
    }))

    setPreviews((prev) => ({
      ...prev,
      [key]: file ? URL.createObjectURL(file) : null,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    setLoading(true)
    setMessage('')

    try {
      const formData = new FormData()
      formData.append('assessmentType', assessmentType)

      Object.entries(files).forEach(([key, file]) => {
        if (file) {
          formData.append(key, file)
        }
      })

      const res = await fetch('/api/assessment-photos/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
  alert(JSON.stringify(data, null, 2))
  throw new Error(data?.details || data?.error || 'Upload failed')
}

      if (assessmentType === 'posture' && postureAssessmentEnabled) {
        const views = (data.uploadedViews || []) as UploadedView[]
        setUploadedRecordId(data.record?.id || null)
        setUploadedViews(views)
        setActiveViewIndex(0)
        setMessage(
          views.length
            ? 'Photos uploaded. Confirm each view before continuing.'
            : 'Photos uploaded, but the editor could not open the images.',
        )
      } else {
        setMessage('Assessment photos uploaded successfully.')
        router.refresh()
      }

      setFiles({
        front: null,
        back: null,
        left: null,
        right: null,
      })

      setPreviews({
        front: null,
        back: null,
        left: null,
        right: null,
      })
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Something went wrong uploading photos.'
      )
    } finally {
      setLoading(false)
    }
  }

  function handleViewConfirmed() {
    if (activeViewIndex + 1 < uploadedViews.length) {
      setActiveViewIndex((index) => index + 1)
      return
    }

    setMessage('Posture landmarks confirmed.')
    setUploadedViews([])
    setUploadedRecordId(null)
    setActiveViewIndex(0)
    router.refresh()
  }

  const activeUploadedView = uploadedViews[activeViewIndex]

  if (uploadedRecordId && activeUploadedView) {
    return (
      <div className="aos-posture-confirmation-flow">
        <div className="aos-posture-progress">
          <p className="aos-eyebrow">Posture review</p>
          <h2>Confirm {POSTURE_VIEW_LABELS[activeUploadedView.view]} landmarks</h2>
          <p>Review the estimated skeleton and move any point that does not line up with your body.</p>
          <div className="aos-posture-view-steps" aria-label="Posture photo views">
            {uploadedViews.map((item, index) => (
              <span key={item.path} className={index === activeViewIndex ? 'is-active' : index < activeViewIndex ? 'is-complete' : ''}>
                {POSTURE_VIEW_LABELS[item.view]}
              </span>
            ))}
          </div>
        </div>
        <PostureLandmarkEditor
          assessmentPhotoId={uploadedRecordId}
          view={activeUploadedView.view}
          imageUrl={activeUploadedView.signedUrl}
          path={activeUploadedView.path}
          onConfirmed={handleViewConfirmed}
        />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="aos-photo-uploader">
      <div className="aos-photo-uploader__header">
        <p className="aos-eyebrow">Private photo tracking</p>
        <h2>{assessmentType==='posture'?'Upload Posture Photos':'Upload Progress Photos'}</h2>
        <p>These photos stay inside your Anastasis account and support visual progress and movement review.</p>
      </div>
      <div className="aos-chip-list"><AOSChip selected={assessmentType==='progress'} onClick={()=>setAssessmentType('progress')}>Progress photos</AOSChip>{postureAssessmentEnabled?<AOSChip selected={assessmentType==='posture'} onClick={()=>setAssessmentType('posture')}>Posture review</AOSChip>:null}</div>
      {!postureAssessmentEnabled ? <p className="aos-status">Progress photo upload and history are available here.</p> : null}
      {assessmentType === 'posture' ? (
        <ul className="aos-posture-instructions">
          {postureInstructions.map((instruction) => (
            <li key={instruction}>{instruction}</li>
          ))}
        </ul>
      ) : null}
      <div className="aos-photo-upload-grid">
        {photoFields.map((field) => (
          <label key={field.key} className={`aos-photo-upload-box${previews[field.key]?' has-preview':''}`}>
            <span className="aos-photo-upload-icon" aria-hidden="true">＋</span>
            <strong>{field.label}</strong>
            <span>{field.description}</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                handleFileChange(
                  field.key,
                  e.target.files?.[0] || null
                )
              }
              className="aos-photo-file-input"
            />
            {previews[field.key] ? (
              <Image
                src={previews[field.key] as string}
                alt={`${field.label} preview`}
                width={420}
                height={560}
                unoptimized
                className="aos-photo-preview"
              />
            ) : null}
            <span className="aos-photo-selected">{files[field.key]?.name || 'Tap to choose photo'}</span>
          </label>
        ))}
      </div>
      <AOSButton type="submit" disabled={loading}>{loading?'Uploading…':`Upload ${assessmentType==='posture'?'Posture':'Progress'} Photos`}</AOSButton>
      {message ? <p className="aos-status" role="status">{message}</p> : null}
    </form>
  )
}
