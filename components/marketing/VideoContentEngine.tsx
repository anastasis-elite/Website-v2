'use client'

import { useState } from 'react'

type MarketingOutput = {
  id: string
  ost: string
  caption: string
  cta: string
  platformNotes: string
}

const campaigns = [
  'Capacity Audit',
  'The Anastasis Shift',
  'EMBER',
  'IGNITE',
  'PHOENIX',
  'Human Engineering',
  'The Capacity Project',
  'Evergreen',
]

const pillars = [
  'Identity',
  'Philosophy',
  'Evidence',
  'Education',
  'Lifestyle',
  'Invitation',
]

const hookFamilies = [
  'Identity',
  'Emotional',
  'Authority',
  'Contrarian',
  'Curiosity',
  'Why Now',
  'Story',
]

const platforms = [
  'TikTok',
  'Instagram',
  'YouTube',
  'Facebook',
  'Threads',
  'Pinterest',
  'LinkedIn',
  'Email',
]

export default function VideoContentEngine() {
  const [video, setVideo] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState('')
  const [campaign, setCampaign] = useState('Capacity Audit')
  const [pillar, setPillar] = useState('Identity')
  const [hookFamily, setHookFamily] = useState('Contrarian')
  const [platform, setPlatform] = useState('TikTok')
  const [topic, setTopic] = useState('')
  const [outputCount, setOutputCount] = useState(5)
  const [outputs, setOutputs] = useState<MarketingOutput[]>([])
  const [loading, setLoading] = useState(false)

  function handleVideoUpload(file: File | null) {
    setVideo(file)

    if (file) {
      setVideoPreview(URL.createObjectURL(file))
    } else {
      setVideoPreview('')
    }
  }

  async function generateOutputs() {
    setLoading(true)
    setOutputs([])

    const formData = new FormData()

    if (video) {
      formData.append('video', video)
    }

    formData.append('campaign', campaign)
    formData.append('pillar', pillar)
    formData.append('hookFamily', hookFamily)
    formData.append('platform', platform)
    formData.append('topic', topic)
    formData.append('outputCount', String(outputCount))

    const res = await fetch('/api/marketing/video-generate', {
      method: 'POST',
      body: formData,
    })

    const data = await res.json()

    setOutputs(data.outputs || [])
    setLoading(false)
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text)
  }

  return (
    <main style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <p style={{ textTransform: 'uppercase', letterSpacing: '0.12em' }}>
        Anastasis Marketing OS
      </p>

      <h1>Video Content Engine</h1>

      <p>
        Upload a video, choose the strategy parameters, and generate aligned OST
        hooks, captions, CTAs, and platform notes.
      </p>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          marginTop: '32px',
        }}
      >
        <div style={{ display: 'grid', gap: '16px' }}>
          <label>
            Video
            <input
              type="file"
              accept="video/*"
              onChange={(e) =>
                handleVideoUpload(e.target.files?.[0] || null)
              }
            />
          </label>

          {videoPreview && (
            <video
              src={videoPreview}
              controls
              style={{
                width: '100%',
                borderRadius: '16px',
                marginTop: '8px',
              }}
            />
          )}

          <label>
            Campaign
            <select
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
            >
              {campaigns.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label>
            Pillar
            <select
              value={pillar}
              onChange={(e) => setPillar(e.target.value)}
            >
              {pillars.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label>
            Hook Family
            <select
              value={hookFamily}
              onChange={(e) => setHookFamily(e.target.value)}
            >
              {hookFamilies.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label>
            Platform
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            >
              {platforms.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>

          <label>
            Number of Outputs
            <input
              type="number"
              min={1}
              max={10}
              value={outputCount}
              onChange={(e) => setOutputCount(Number(e.target.value))}
            />
          </label>

          <label>
            Video Topic / Context
            <textarea
              rows={5}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Example: Gym mirror clip. I want to tell women discipline is not the problem; capacity is."
            />
          </label>

          <button
            onClick={generateOutputs}
            disabled={loading || !topic}
            style={{
              padding: '12px 16px',
              borderRadius: '999px',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Generating...' : 'Generate Content Options'}
          </button>
        </div>

        <div style={{ display: 'grid', gap: '16px' }}>
          {outputs.length === 0 && (
            <div
              style={{
                padding: '24px',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '16px',
              }}
            >
              <h2>No outputs yet.</h2>
              <p>Your generated OST and captions will appear here.</p>
            </div>
          )}

          {outputs.map((output, index) => (
            <article
              key={output.id}
              style={{
                padding: '24px',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '16px',
              }}
            >
              <p style={{ textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                Option {index + 1}
              </p>

              <h3>OST</h3>
              <p>{output.ost}</p>

              <h3>Caption</h3>
              <p style={{ whiteSpace: 'pre-wrap' }}>{output.caption}</p>

              <h3>CTA</h3>
              <p>{output.cta}</p>

              <h3>Platform Notes</h3>
              <p>{output.platformNotes}</p>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button onClick={() => copyText(output.ost)}>
                  Copy OST
                </button>

                <button onClick={() => copyText(output.caption)}>
                  Copy Caption
                </button>

                <button onClick={() => copyText(`${output.ost}\n\n${output.caption}`)}>
                  Copy All
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
