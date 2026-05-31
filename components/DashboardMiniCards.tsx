import Link from 'next/link'
import * as styles from '@/app/styles/globalstyles'

type MiniCard = {
  id: string
  title: string
  value: string
  body?: string
  href?: string
  status?: 'neutral' | 'complete' | 'attention' | 'caution'
}

export default function DashboardMiniCards({
  cards,
}: {
  cards: MiniCard[]
}) {
  if (!cards.length) return null

  return (
    <section
      style={{
        marginBottom: '36px',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
        }}
      >
        {cards.map((card) => {
          const content = (
            <div
              style={{
                background:
                  card.status === 'attention'
                    ? 'rgba(181,110,67,0.12)'
                    : 'rgba(255,255,255,0.035)',
                borderRadius: '24px',
                padding: '20px',
                minHeight: '128px',
                boxShadow:
                  '0 18px 54px rgba(0,0,0,0.16), inset 0 0 26px rgba(255,255,255,0.012)',
                backdropFilter: 'blur(16px)',
                cursor: card.href ? 'pointer' : 'default',
                transition: 'all 0.22s ease',
              }}
            >
              <p
                style={{
                  ...styles.eyebrowStyle,
                  marginBottom: '12px',
                  letterSpacing: '3px',
                  fontSize: '10px',
                }}
              >
                {card.title}
              </p>

              <h3
                style={{
                  margin: '0 0 8px',
                  fontSize: '1.3rem',
                  fontWeight: 500,
                  letterSpacing: '-0.02em',
                  color: '#f5f0e8',
                }}
              >
                {card.value}
              </h3>

              {card.body ? (
                <p
                  style={{
                    margin: 0,
                    color: 'rgba(215,199,182,0.76)',
                    fontSize: '0.92rem',
                    lineHeight: 1.6,
                  }}
                >
                  {card.body}
                </p>
              ) : null}
            </div>
          )

          return card.href ? (
            <Link key={card.id} href={card.href}>
              {content}
            </Link>
          ) : (
            <div key={card.id}>{content}</div>
          )
        })}
      </div>
    </section>
  )
}
