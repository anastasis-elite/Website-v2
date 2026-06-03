'use client'

import { useState } from 'react'

type PhotoKey = 'front' | 'back' | 'left' | 'right'

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

export default function AssessmentPhotoUpload() {
  const [files, setFiles] = useState<Record<PhotoKey, File | null>>({
    front: null,
    back: null,
    left: null,
    right: null,
  })

  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const [previews, setPreviews] = useState<Record<PhotoKey, string | null>>({
  front: null,
  back: null,
  left: null,
  right: null,
})
  
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
      formData.append('assessmentType', 'monthly')

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
        throw new Error(data?.details || data?.error || 'Upload failed')
      }

      setMessage('Assessment photos uploaded successfully.')
      setFiles({
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

  return (
    <form onSubmit={handleSubmit} style={cardStyle}>
      <div>
        <p style={eyebrowStyle}>Monthly Assessment</p>

        <h2 style={titleStyle}>Upload Assessment Photos</h2>

        <p style={bodyStyle}>
          These photos are used for posture, symmetry, and progress assessment
          inside your Anastasis dashboard.
        </p>
      </div>

      <div style={gridStyle}>
        {photoFields.map((field) => (
          <label key={field.key} style={uploadBoxStyle}>
            <strong>{field.label}</strong>
            <span style={smallTextStyle}>{field.description}</span>

            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                handleFileChange(
                  field.key,
                  e.target.files?.[0] || null
                )
              }
              style={fileInputStyle}
            />

            {previews[field.key] ? (
  <img
    src={previews[field.key] as string}
    alt={`${field.label} preview`}
    style={{
      width: '100%',
      maxHeight: 220,
      objectFit: 'cover',
      borderRadius: 16,
      marginTop: 10,
    }}
  />
) : null}
            
            <span style={selectedStyle}>
              {files[field.key]?.name || 'Choose photo'}
            </span>
          </label>
        ))}
      </div>

      <button type="submit" disabled={loading} style={buttonStyle}>
        {loading ? 'Uploading...' : 'Upload Assessment Photos'}
      </button>

      {message ? <p style={bodyStyle}>{message}</p> : null}
      setPreviews({
  front: null,
  back: null,
  left: null,
  right: null,
})
    </form>
  )
}

const cardStyle = {
  width: '100%',
  display: 'grid',
  gap: '24px',
  padding: '28px',
  borderRadius: '28px',
  background: 'rgba(255,255,255,0.025)',
  boxShadow:
    '0 24px 80px rgba(0,0,0,0.18), inset 0 0 40px rgba(255,255,255,0.018)',
} as const

const eyebrowStyle = {
  margin: 0,
  textTransform: 'uppercase',
  letterSpacing: '0.22em',
  color: '#b7a58f',
  fontSize: '0.72rem',
} as const

const titleStyle = {
  margin: '8px 0 0',
  color: '#f3eee8',
  fontWeight: 500,
  fontSize: 'clamp(1.8rem, 4vw, 3rem)',
  lineHeight: 1.05,
} as const

const bodyStyle = {
  margin: 0,
  color: 'rgba(243,238,232,0.82)',
  lineHeight: 1.8,
  fontSize: '0.98rem',
} as const

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: '14px',
} as const

const uploadBoxStyle = {
  display: 'grid',
  gap: '8px',
  padding: '18px',
  borderRadius: '22px',
  border: '1px solid rgba(181,110,67,0.22)',
  background: 'rgba(181,110,67,0.045)',
  cursor: 'pointer',
} as const

const smallTextStyle = {
  color: 'rgba(243,238,232,0.66)',
  fontSize: '0.82rem',
  lineHeight: 1.45,
} as const

const fileInputStyle = {
  display: 'none',
} as const

const selectedStyle = {
  color: '#f5f0e8',
  fontSize: '0.86rem',
  paddingTop: '8px',
} as const

const buttonStyle = {
  border: '1px solid rgba(181,110,67,0.32)',
  color: '#f5f0e8',
  padding: '13px 18px',
  textDecoration: 'none',
  borderRadius: '999px',
  fontWeight: 500,
  background: 'rgba(181,110,67,0.12)',
  fontSize: '0.92rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
} as const
