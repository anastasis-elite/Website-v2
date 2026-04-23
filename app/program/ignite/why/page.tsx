export default function IgniteWhyPage() {
  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <h1>Why Ignite</h1>
        <p>
          Ignite is for women ready for deeper guidance, structure, and support.
        </p>
        <a href="/program/ignite/cart">Continue to Ignite</a>
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
