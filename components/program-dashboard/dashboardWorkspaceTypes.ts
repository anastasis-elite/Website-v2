export type PlanBlock = {
  id: 'morning' | 'midday' | 'evening'
  title: string
  focus: string
  tasks: Array<{ id: string; label: string; href: string; complete: boolean; detail?: string }>
}
