export function AOSToggle({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="aos-toggle"><span className="aos-toggle__copy"><strong>{label}</strong>{description ? <small>{description}</small> : null}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="aos-toggle__track" aria-hidden="true"><span /></span></label>
}
