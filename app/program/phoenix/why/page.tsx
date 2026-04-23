
export default function PhoenixWhyPage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <h1>Why Phoenix</h1>
        <p>
          Phoenix is for full transformation — guided, precise, and high-touch.
        </p>
        <a href="/program/phoenix/cart">Continue to Phoenix</a>
      </div>
    </main>
  )
}

const pageStyle = {
  background: '#000',
  color: '#f5f0e8',
  minHeight: '100vh',
  padding: '120px 24px',
}

const containerStyle = {
  maxWidth: '900px',
  margin: '0 auto',
}
