import * as styles from '../styles/globalstyles'

export default function ProgramPage() {
  return (
    <main style={styles.pageStyle}>
      <div style={{ ...styles.containerStyle, maxWidth: '1080px' }}>
        
        {/* HERO */}
        <section style={{ marginBottom: '120px' }}>
          <p style={styles.eyebrowStyle}>The Program</p>

          <h1 style={{ ...styles.heroTitleStyle, maxWidth: '980px' }}>
            A woman-centered system built for progress that actually fits your body.
          </h1>

          <p style={{ ...styles.heroTextStyle, maxWidth: '820px' }}>
            This is not another generic fitness structure repackaged in softer language.
            It is a system designed around female physiology, female recovery, female
            stress response, and the reality that women do not need more punishment.
            They need better design.
          </p>

          <div style={styles.buttonRowStyle}>
            <a href="/apply" style={styles.primaryButtonStyle}>
              Apply Now
            </a>

            <a href="/" style={styles.secondaryButtonStyle}>
              Return Home
            </a>
          </div>
        </section>

        {/* DIFFERENCE BLOCKS */}
        <section style={{ marginBottom: '120px' }}>
          <div style={{ display: 'grid', gap: '28px' }}>
            
            {[
              {
                title: 'What makes this different',
                text: `Most programs are built around male recovery speed, male hormonal rhythm,
                male stress patterns, and male performance assumptions. Women are then told
                to adapt to systems that were never designed with them in mind. This method
                begins in the opposite place. It starts by reading your body correctly, then
                building the structure around what supports progress instead of what creates
                more friction.`,
              },
              {
                title: 'What this is designed to do',
                text: `Reduce friction. Restore trust with your body. Create progress that feels
                aligned instead of forced. Support performance without making you pay for it
                with exhaustion, volatility, shutdown, or self-blame. Build a system that
                helps you become stronger, more regulated, more responsive, and more precise
                over time.`,
              },
              {
                title: 'Who this is for',
                text: `Women who are tired of being told to just push harder. Women who have done
                the work, stayed disciplined, followed the plan, and still felt like their
                body was resisting them. Women who want a system that respects both ambition
                and biology. Women who are ready for structure that feels intelligent,
                supportive, and exact.`,
              },
            ].map((item) => (
              <div key={item.title} style={styles.cartBoxStyle}>
                <h2 style={{ ...styles.sectionTitleStyle, fontSize: '1.5rem' }}>
                  {item.title}
                </h2>

                <p style={{ ...styles.bodyStyle, maxWidth: '860px', margin: 0 }}>
                  {item.text}
                </p>
              </div>
            ))}

          </div>
        </section>

        {/* INSIDE METHOD */}
        <section style={{ marginBottom: '120px' }}>
          <p style={styles.eyebrowStyle}>Inside the method</p>

          <h2 style={{ ...styles.heroTitleStyle, fontSize: 'clamp(2rem, 4vw, 3.6rem)' }}>
            The system is not built on more pressure.
            <br />
            It is built on better calibration.
          </h2>

          <div style={styles.cardGridStyle}>
            {[
              {
                title: 'Physiology-aware structure',
                text: 'Training and progress are approached through the reality of female recovery, stress response, energy fluctuation, and body feedback.',
              },
              {
                title: 'Nervous system respect',
                text: 'The body is not treated like a machine to override. Signals are used as guidance so progress becomes more sustainable and more intelligent.',
              },
              {
                title: 'Precision over chaos',
                text: 'Every element is intended to reduce decision fatigue and create clarity, rhythm, and consistency instead of more overwhelm.',
              },
              {
                title: 'Real-life execution',
                text: 'This is built for women with actual lives, real stress, real responsibilities, and bodies that deserve better than generic formulas.',
              },
              {
                title: 'Supportive progression',
                text: 'The aim is not just to make you work. The aim is to make your effort translate into movement, strength, trust, and visible progress.',
              },
              {
                title: 'Designed outcomes',
                text: 'This is not random motivation. It is a system built to create a clear path from confusion and friction into alignment and momentum.',
              },
            ].map((item) => (
              <div key={item.title} style={styles.cardStyle}>
                <h3 style={styles.cardTitleStyle}>{item.title}</h3>
                <p style={styles.cardTextStyle}>{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FEEL SECTION */}
        <section style={{ marginBottom: '120px' }}>
          <p style={styles.eyebrowStyle}>What this can feel like</p>

          <div style={{ display: 'grid', gap: '24px', maxWidth: '900px' }}>
            {[
              'Feeling like your body is finally being read correctly instead of fought.',
              'Having a structure that feels clear, calm, and supportive instead of chaotic.',
              'Experiencing progress that does not require constant self-override to maintain.',
              'Being able to trust your body’s feedback instead of resenting it.',
              'Feeling more anchored, more capable, and less trapped in friction.',
            ].map((line) => (
              <div key={line} style={{ borderLeft: '2px solid #c58b57', paddingLeft: '18px' }}>
                <p style={{ ...styles.bodyStyle, margin: 0 }}>{line}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section
          style={{
            ...styles.cartBoxStyle,
            textAlign: 'center',
            padding: '42px 32px',
          }}
        >
          <p style={styles.eyebrowStyle}>Next step</p>

          <h2 style={{ ...styles.heroTitleStyle, fontSize: 'clamp(2rem, 4vw, 3.2rem)', margin: '0 auto 22px auto' }}>
            If this feels like relief, that is the point.
          </h2>

          <p style={{ ...styles.heroTextStyle, maxWidth: '760px', margin: '0 auto 36px auto' }}>
            The next step is application and fit. This is designed to be intentional,
            supportive, and aligned — not mass-market, rushed, or impersonal.
          </p>

          <div style={{ ...styles.buttonRowStyle, justifyContent: 'center' }}>
            <a href="/apply" style={styles.primaryButtonStyle}>
              Apply Now
            </a>

            <a href="/" style={styles.secondaryButtonStyle}>
              Return Home
            </a>
          </div>
        </section>

      </div>
    </main>
  )
}
