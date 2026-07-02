import { redirect } from 'next/navigation'

export default async function SymptomsPage() {
  redirect('/dashboard/check-in')
}
