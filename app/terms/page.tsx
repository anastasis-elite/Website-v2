
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
  
export default function TermsPage() {
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
          Terms of Use
        </p>

        <h1
          style={{
            fontSize: 'clamp(2.5rem, 5vw, 4.8rem)',
            lineHeight: 1.12,
            marginBottom: '28px',
          }}
        >
          Terms of Use
        </h1>

        <p style={bodyStyle}>
This program is designed as a structured system for performance, physique development,
and alignment with female physiology. By accessing or participating in this program,
you acknowledge and agree to the following terms.
</p>

<h2 style={h2Style}>Program Nature</h2>
<p style={bodyStyle}>
This is a coaching and systems-based program. All outputs, guidance, and structure are
based on the accuracy and consistency of the information you provide, as well as your
execution of the program as designed.
</p>

<h2 style={h2Style}>Execution Responsibility</h2>
<p style={bodyStyle}>
Results are dependent on full and accurate execution. Partial implementation,
modification without guidance, or inconsistent adherence to the system may impact
outcomes. By participating, you accept responsibility for your level of execution
and understand that outcomes cannot be guaranteed without full participation.
</p>

<h2 style={h2Style}>No Refund Policy</h2>
<p style={bodyStyle}>
Due to the nature of this program and the immediate access to intellectual property,
systems, and structure, all payments are final. No refunds, partial refunds, or
compensation will be issued based on lack of execution, perceived results, or
non-compliance with the program.
</p>

<h2 style={h2Style}>Professional Scope</h2>
<p style={bodyStyle}>
This program is created and delivered by a certified personal trainer and nutrition
coach with specializations in weight loss, gym design, and ongoing expansion into
corrective exercise. This program is not medical care, and does not replace licensed
medical guidance.
</p>

<h2 style={h2Style}>Agreement</h2>
<p style={bodyStyle}>
By participating in this program, you acknowledge that you understand these terms and
accept full responsibility for your participation, execution, and outcomes.
</p>
      </div>
    </main>
  )
}
