export function AOSSectionHeader({ eyebrow, title, copy }: { eyebrow?: string; title: string; copy?: string }) {
  return <header className="aos-section-header">{eyebrow ? <p className="aos-eyebrow">{eyebrow}</p> : null}<h2>{title}</h2>{copy ? <p>{copy}</p> : null}</header>
}
