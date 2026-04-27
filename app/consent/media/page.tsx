import {
  pageStyle,
  containerStyle,
  eyebrowStyle,
  heroTitleStyle,
  heroTextStyle,
  sectionStyle,
  sectionTitleStyle,
  bodyStyle,
  cardGridStyle,
  cardStyle,
  cardTitleStyle,
  cardTextStyle,
  cartBoxStyle,
  buttonRowStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
  quietLinkStyle,
  gridTwoCol,
  fieldWrap,
  labelStyle,
  inputStyle,
  textareaStyle,
} from '../../styles/globalStyles'

export default function MediaConsentPage() {
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
          Media Consent
        </p>

        <h1
          style={{
            fontSize: 'clamp(2.5rem, 5vw, 4.8rem)',
            lineHeight: 1.12,
            marginBottom: '48px',
            maxWidth: '860px',
          }}
        >
          Media Consent
        </h1>

        <p style={bodyStyle}>
          Authorization for the use of transformation photos, progress photos, and
          related visual media is optional. Choosing not to authorize media use does not
          prevent you from participating in the program itself.
        </p>

        <h2 style={h2Style}>What this consent covers</h2>
        <p style={bodyStyle}>
          If you choose to authorize media use, your approved transformation photos,
          progress photos, and related visual content may be used for educational,
          research, and marketing purposes.
        </p>

        <h2 style={h2Style}>How your media may be used</h2>
        <p style={bodyStyle}>
          Authorized media may be used in content, promotional materials, educational
          materials, case studies, or related brand communications. No personal
          identifying information will be shared unless separately and explicitly
          authorized or already included in previously approved content.
        </p>

        <h2 style={h2Style}>Revoking consent</h2>
        <p style={bodyStyle}>
          Media consent may be granted or revoked at any time. If consent is revoked, no
          new visual media will be used moving forward.
        </p>

        <h2 style={h2Style}>Previously authorized content</h2>
        <p style={bodyStyle}>
          You acknowledge and agree that any media previously authorized and already
          used in published materials, distributed marketing assets, educational
          materials, or other completed content may continue to be used. Revocation
          applies moving forward and does not require the removal or reversal of content
          that was created and used under valid authorization.
        </p>

        <h2 style={h2Style}>Your choice</h2>
        <p style={bodyStyle}>
          By opting in, you are authorizing approved visual media use under these terms.
          By opting out, your participation in the program remains unaffected, but your
          future images and related visual content will not be newly used for these
          purposes.
        </p>
      </div>
    </main>
  )
}

