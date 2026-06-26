// components/marketing/MarketingEngine.tsx

'use client'

import { useState } from 'react'

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

export default function MarketingEngine() {
  const [campaign, setCampaign] = useState('Capacity Audit')
  const [pillar, setPillar] = useState('Identity')
  const [hookFamily, setHookFamily] = useState('Contrarian')
  const [platform, setPlatform] = useState('TikTok')
  const [topic, setTopic] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)

  async function generateContent() {
    setLoading(true)
    setOutput('')

    const res = await fetch('/api/marketing/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign,
        pillar,
        hookFamily,
        platform,
        topic,
      }),
    })

    const data = await res.json()

    setOutput(data.output || 'No output generated.')
    setLoading(false)
  }

  return (
    <main style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>
      <h1>Marketing OS</h1>
      <p>
        Generate aligned content using the Anastasis strategy, campaign,
        pillar, hook family, and platform.
      </p>

      <section style={{ display: 'grid', gap: '16px', marginTop: '24px' }}>
        <select value={campaign} onChange={(e) => setCampaign(e.target.value)}>
          {campaigns.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>

        <select value={pillar} onChange={(e) => setPillar(e.target.value)}>
          {pillars.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>

        <select
          value={hookFamily}
          onChange={(e) => setHookFamily(e.target.value)}
        >
          {hookFamilies.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>

        <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
          {platforms.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>

        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="What do you want to create content about?"
          rows={5}
          style={{ padding: '12px' }}
        />

        <button onClick={generateContent} disabled={loading || !topic}>
          {loading ? 'Generating...' : 'Generate Content'}
        </button>
      </section>

      {output && (
        <section style={{ marginTop: '32px' }}>
          <h2>Output</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{output}</pre>
        </section>
      )}
    </main>
  )
}
