
export default function ResearchConsentPage() {
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
          Research Consent
        </p>

        <h1
          style={{
            fontSize: 'clamp(2.5rem, 5vw, 4.8rem)',
            lineHeight: 1.12,
            marginBottom: '48px',
            maxWidth: '860px',
          }}
        >
          Research Consent
        </h1>

        <p style={bodyStyle}>
          Participation in research data collection is optional. Choosing not to
          participate does not prevent you from applying for or participating in the
          program itself.
        </p>

        <h2 style={h2Style}>What this consent covers</h2>
        <p style={bodyStyle}>
          If you choose to authorize research use, selected information related to your
          implementation, adherence, progress, and outcomes may be used to evaluate how
          the program is working across participants.
        </p>

        <h2 style={h2Style}>Privacy and confidentiality</h2>
        <p style={bodyStyle}>
          Your information remains private. Personal identifying information will not be
          shared publicly as part of research use unless separate and explicit
          permission is given. Research use is intended to focus on patterns, outcomes,
          and implementation rather than public disclosure of identity.
        </p>

        <h2 style={h2Style}>Revoking consent</h2>
        <p style={bodyStyle}>
          Research consent may be granted or revoked at any time. If consent is revoked,
          no new data moving forward will be used for research purposes.
        </p>

        <h2 style={h2Style}>Previously used data</h2>
        <p style={bodyStyle}>
          If consent is revoked after data has already been included in internal
          research analysis, aggregated reporting, or anonymized evaluation already in
          use, that prior use may continue. Revocation applies moving forward and does
          not require the reversal of previously completed analysis created under valid
          authorization.
        </p>

        <h2 style={h2Style}>Your choice</h2>
        <p style={bodyStyle}>
          By opting in, you are authorizing the use of approved data for research and
          evaluation purposes under these terms. By opting out, your program
          participation remains unaffected, but your data will not be newly included for
          research use.
        </p>
      </div>
    </main>
  )
}

const bodyStyle: React.CSSProperties = {
  color: '#d7c7b6',
  lineHeight: 1.9,
  fontSize: '1.05rem',
  marginBottom: '28px',
  maxWidth: '800px',
}

const h2Style: React.CSSProperties = {
  fontSize: '1.4rem',
  marginBottom: '10px',
  marginTop: '36px',
  fontWeight: 500,
}
