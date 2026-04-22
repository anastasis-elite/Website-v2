const pillars = [
  {
    title: "Built for women, not adapted for them",
    body:
      "Most programs were shaped around male performance patterns, then lightly reworded for women. This space starts with female physiology, recovery, hormones, and nervous system load.",
  },
  {
    title: "Luxury in the way you are held",
    body:
      "Luxury is not noise. It is precision, pacing, discernment, and being guided by a system that understands what your body is asking for.",
  },
  {
    title: "A place that feels like relief",
    body:
      "The right system does not make you feel broken. It makes you feel seen. It brings your body out of defense and into direction.",
  },
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero">
        <div className="logo-wrap">
          <div className="logo-frame" aria-label="Brand logo placeholder">
            <span>LOGO</span>
          </div>
        </div>

        <p className="eyebrow">Woman-centered performance architecture</p>

        <h1>
          The place where women stop forcing male-built systems
          <span> and finally come home to a body-led way forward.</span>
        </h1>

        <p className="lead">
          This is not another program asking you to override your body harder.
          It is a refined, woman-centered space designed to help you feel safe,
          understood, and accurately guided—so progress stops feeling like a
          fight.
        </p>

        <div className="hero-actions">
          <a href="#apply" className="button primary">
            Enter the space
          </a>
          <a href="#difference" className="button secondary">
            See the difference
          </a>
        </div>
      </section>

      <section id="difference" className="section intro-grid">
        <div>
          <p className="section-label">Why this feels different</p>
          <h2>
            Because women were never the problem.
            <span> The systems were.</span>
          </h2>
        </div>
        <div>
          <p>
            For decades, performance advice has centered male execution:
            higher-output recovery assumptions, different hormonal rhythms,
            different stress responses, different adaptation patterns. Women
            were told to fit into frameworks that did not begin with them.
          </p>
          <p>
            This brand exists to correct that. Not with fluff. With precision,
            emotional intelligence, and physiology-first design.
          </p>
        </div>
      </section>

      <section className="section cards-section">
        <div className="cards-grid">
          {pillars.map((pillar) => (
            <article className="card" key={pillar.title}>
              <h3>{pillar.title}</h3>
              <p>{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section statement-band">
        <p>
          You are not behind. You are not failing. You may have simply been
          handed strategies that were never designed around the reality of a
          woman’s body.
        </p>
      </section>

      <section className="section two-column">
        <div>
          <p className="section-label">What she feels here</p>
          <h2>Seen. Safe. Capable. Led.</h2>
        </div>
        <div>
          <p>
            She lands here exhausted by contradiction, tired of being told to
            push harder, eat less, ignore the signals, and blame herself when it
            stops working.
          </p>
          <p>
            What she finds instead is a high-touch experience that honors her
            biology, reduces decision fatigue, and gives her a clear path back to
            trust—in her body, in the process, and in her capacity.
          </p>
        </div>
      </section>

      <section id="apply" className="section cta-section">
        <p className="section-label">Not just a program</p>
        <h2>A woman-centered system for those ready to be held well.</h2>
        <p>
          If you’ve been looking for answers that actually account for the way a
          woman’s body performs, recovers, protects, and responds, this is where
          we begin.
        </p>
        <a href="mailto:hello@yourdomain.com" className="button primary">
          Apply for access
        </a>
      </section>
    </main>
  );
}
