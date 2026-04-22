const bodyStyle = {
  color: '#d7c7b6',
  lineHeight: 1.9,
  fontSize: '1.05rem',
  marginBottom: '28px',
  maxWidth: '800px',
}

const h2Style = {
  fontSize: '1.4rem',
  marginBottom: '10px',
  marginTop: '36px',
  fontWeight: 500,
}

export default function ConditionsPage() {
  return (
    <main
      style={{
        background: '#000',
        color: '#f5f0e8',
        minHeight: '100vh',
        padding: '120px 24px',
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <p
          style={{
            letterSpacing: '6px',
            fontSize: '12px',
            color: '#c58b57',
            opacity: 0.85,
            marginBottom: '24px',
            textTransform: 'uppercase',
          }}
        >
          Health Disclaimer
        </p>

        <h1
          style={{
            fontSize: 'clamp(2.5rem, 5vw, 4.8rem)',
            lineHeight: 1.12,
            marginBottom: '48px',
          }}
        >
          Health Disclaimer &amp; Liability Waiver
        </h1>

        <p style={bodyStyle}>
          This program is designed for educational and coaching purposes only and is
          not intended to diagnose, treat, or replace medical care.
        </p>

        <h2 style={h2Style}>No Medical Diagnosis</h2>
        <p style={bodyStyle}>
          All information, recommendations, and program structures are provided for
          general education and performance guidance. Nothing within this program
          should be interpreted as medical advice or diagnosis.
        </p>

        <h2 style={h2Style}>Medical Conditions</h2>
        <p style={bodyStyle}>
          If you have any existing medical conditions, injuries, or health concerns,
          you are responsible for consulting with a qualified healthcare provider
          prior to participating. If you choose to proceed despite a known condition,
          you accept full responsibility for that decision.
        </p>

        <h2 style={h2Style}>Pregnancy &amp; Supervision</h2>
        <p style={bodyStyle}>
          If you are pregnant, nursing, or under medical supervision, you acknowledge
          that participation in this program is done at your own discretion and risk
          unless explicitly cleared by your medical provider.
        </p>

        <h2 style={h2Style}>Injury &amp; Execution</h2>
        <p style={bodyStyle}>
          All training guidance, cues, and instructions must be followed accurately.
          Improper execution, modification, or disregard of instructions may increase
          the risk of injury. You acknowledge that you are responsible for how
          movements and protocols are performed.
        </p>

        <h2 style={h2Style}>Limitation of Liability</h2>
        <p style={bodyStyle}>
          By participating in this program, you agree that the program creator and
          associated entities are not liable for any injury, health complication, or
          escalation of existing conditions that may occur during or after
          participation.
        </p>

        <h2 style={h2Style}>Assumption of Risk</h2>
        <p style={bodyStyle}>
          Participation in any fitness or performance-based program carries inherent
          risk. By continuing, you acknowledge and accept these risks in full.
        </p>
      </div>
    </main>
  )
}
